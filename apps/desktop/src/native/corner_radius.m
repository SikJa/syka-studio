/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// Node-API addon that gives the Electron BrowserWindow a custom corner radius
// while keeping the STANDARD window: native traffic lights, OS drop shadow,
// vibrancy, and live resize all survive. Electron only exposes the fixed
// system radius, hence the private-API work below.
//
// Mechanism (after github.com/makalin/CornerFix and lin-outliner#58):
//   - macOS 26 "Tahoe" shapes the frame + shadow from the private radius
//     getters (_cornerRadius / _effectiveCornerRadius / _topCornerRadius /
//     _bottomCornerRadius), so those are swizzled on the window's real
//     dispatch class to return a per-window radius stored as an associated
//     object. The system re-reads them on every relayout, so the value
//     persists without re-applying.
//   - macOS < 26 still honors _cornerMask, so that is overridden too.
//   - The vibrancy frost is rounded via NSVisualEffectView.maskImage (public
//     API) — masking an ancestor layer instead would kill behind-window
//     blending and leave AppKit's border stroke at the system radius.
// Because this rides Apple's own corner + default shadow path, it avoids the
// WindowServer GPU cost that made Electron drop its _cornerMask override
// (electron/electron#48376).
//
// Built by scripts/build-native.mjs; loaded from dist/ at runtime.

#import <AppKit/AppKit.h>
#import <objc/message.h>
#import <objc/runtime.h>
#include "vendor/node_api.h"

// Per-window desired radius (NSNumber) and corner mask (NSImage), read back
// by the swizzled getters. nil => fall back to the OS default corner.
static const void* kRadiusKey = &kRadiusKey;
static const void* kMaskKey = &kMaskKey;

// Captured originals, the per-window fallback so windows with no radius set
// keep the OS default.
static IMP g_origCornerMask = NULL;
static IMP g_origCornerRadius = NULL;
static IMP g_origEffectiveCornerRadius = NULL;
static IMP g_origTopCornerRadius = NULL;
static IMP g_origBottomCornerRadius = NULL;

// Resizable rounded-rect mask: opaque inside, transparent corners; capInsets
// keep the corners crisp while the centre stretches with the window.
static NSImage* RoundedMaskImage(CGFloat radius) {
  CGFloat side = radius * 2 + 1;
  NSImage* image = [[NSImage alloc] initWithSize:NSMakeSize(side, side)];
  [image lockFocus];
  [[NSColor blackColor] setFill];
  [[NSBezierPath bezierPathWithRoundedRect:NSMakeRect(0, 0, side, side)
                                   xRadius:radius
                                   yRadius:radius] fill];
  [image unlockFocus];
  image.capInsets = NSEdgeInsetsMake(radius, radius, radius, radius);
  image.resizingMode = NSImageResizingModeStretch;
  return image;
}

static void RoundEffectViews(NSView* view, NSImage* mask) {
  if ([view isKindOfClass:[NSVisualEffectView class]]) {
    ((NSVisualEffectView*)view).maskImage = mask;
  }
  for (NSView* sub in view.subviews) RoundEffectViews(sub, mask);
}

static NSImage* ds_cornerMask(id self, SEL _cmd) {
  NSImage* mask = objc_getAssociatedObject(self, kMaskKey);
  if (mask != nil) return mask;
  if (g_origCornerMask != NULL) {
    return ((NSImage* (*)(id, SEL))g_origCornerMask)(self, _cmd);
  }
  return nil;
}

// One replacement for every radius getter: return this window's stored
// radius, else defer to the captured original for that selector.
static CGFloat ds_radius(id self, SEL _cmd) {
  NSNumber* r = objc_getAssociatedObject(self, kRadiusKey);
  if (r != nil) return (CGFloat)r.doubleValue;
  IMP orig = NULL;
  if (sel_isEqual(_cmd, @selector(_cornerRadius))) orig = g_origCornerRadius;
  else if (sel_isEqual(_cmd, @selector(_effectiveCornerRadius))) orig = g_origEffectiveCornerRadius;
  else if (sel_isEqual(_cmd, @selector(_topCornerRadius))) orig = g_origTopCornerRadius;
  else if (sel_isEqual(_cmd, @selector(_bottomCornerRadius))) orig = g_origBottomCornerRadius;
  if (orig != NULL) return ((CGFloat (*)(id, SEL))orig)(self, _cmd);
  return 0;
}

// Swizzle one getter on the real dispatch class, capturing the original once.
// No-op when the selector does not exist on this OS version.
static void SwizzleRadiusGetter(Class cls, SEL sel, IMP* origStore) {
  Method m = class_getInstanceMethod(cls, sel);
  if (m == NULL) return;
  if (*origStore == NULL) *origStore = method_getImplementation(m);
  if (class_getMethodImplementation(cls, sel) != (IMP)ds_radius) {
    class_replaceMethod(cls, sel, (IMP)ds_radius, "d@:");
  }
}

static void CallRadiusSetter(NSWindow* window, SEL sel, CGFloat radius) {
  if (![window respondsToSelector:sel]) return;
  ((void (*)(id, SEL, CGFloat))objc_msgSend)(window, sel, radius);
}

// setCornerRadius(handle: Buffer, radius: number) — handle is the Buffer
// returned by BrowserWindow.getNativeWindowHandle(), which on macOS holds an
// NSView*. A radius of 0 restores the OS default corner (used in fullscreen).
static napi_value SetCornerRadius(napi_env env, napi_callback_info info) {
  size_t argc = 2;
  napi_value argv[2];
  napi_get_cb_info(env, info, &argc, argv, NULL, NULL);
  if (argc < 2) {
    napi_throw_error(env, NULL, "expected (handle: Buffer, radius: number)");
    return NULL;
  }

  void* data = NULL;
  size_t length = 0;
  if (napi_get_buffer_info(env, argv[0], &data, &length) != napi_ok ||
      length < sizeof(NSView*)) {
    napi_throw_error(env, NULL, "handle must be the getNativeWindowHandle() Buffer");
    return NULL;
  }
  double radius = 0;
  napi_get_value_double(env, argv[1], &radius);

  NSView* view = *(NSView* __unsafe_unretained*)data;
  NSWindow* window = view.window;
  if (!window) return NULL;

  Class realCls = object_getClass(window);
  NSImage* mask = radius > 0 ? RoundedMaskImage((CGFloat)radius) : nil;

  RoundEffectViews(window.contentView, mask);

  objc_setAssociatedObject(window, kRadiusKey,
                           radius > 0 ? @(radius) : nil,
                           OBJC_ASSOCIATION_RETAIN_NONATOMIC);
  objc_setAssociatedObject(window, kMaskKey, mask,
                           OBJC_ASSOCIATION_RETAIN_NONATOMIC);

  // Swizzle on the real dispatch class — a KVO-observed window's actual class
  // is a dynamic NSKVONotifying_* subclass, not [window class].
  SwizzleRadiusGetter(realCls, @selector(_cornerRadius), &g_origCornerRadius);
  SwizzleRadiusGetter(realCls, @selector(_effectiveCornerRadius), &g_origEffectiveCornerRadius);
  SwizzleRadiusGetter(realCls, @selector(_topCornerRadius), &g_origTopCornerRadius);
  SwizzleRadiusGetter(realCls, @selector(_bottomCornerRadius), &g_origBottomCornerRadius);
  if (g_origCornerMask == NULL) {
    Method base = class_getInstanceMethod([NSWindow class], @selector(_cornerMask));
    if (base != NULL) g_origCornerMask = method_getImplementation(base);
  }
  if (class_getMethodImplementation(realCls, @selector(_cornerMask)) != (IMP)ds_cornerMask) {
    class_replaceMethod(realCls, @selector(_cornerMask), (IMP)ds_cornerMask, "@@:");
  }

  // Push the value through the setters once so any cached backing field
  // updates immediately, then nudge a recompute + shadow refresh.
  CallRadiusSetter(window, @selector(_setCornerRadius:), (CGFloat)radius);
  CallRadiusSetter(window, @selector(_setEffectiveCornerRadius:), (CGFloat)radius);
  if ([window respondsToSelector:@selector(_updateCornerMask)]) {
    ((void (*)(id, SEL))objc_msgSend)(window, @selector(_updateCornerMask));
  }
  [window invalidateShadow];
  return NULL;
}

static NSVisualEffectView* FindEffectView(NSView* view) {
  if ([view isKindOfClass:[NSVisualEffectView class]]) return (NSVisualEffectView*)view;
  for (NSView* sub in view.subviews) {
    NSVisualEffectView* found = FindEffectView(sub);
    if (found) return found;
  }
  return nil;
}

static CALayer* FindBackdropLayer(CALayer* layer) {
  if ([NSStringFromClass(layer.class) isEqualToString:@"CABackdropLayer"]) return layer;
  for (CALayer* sub in layer.sublayers) {
    CALayer* found = FindBackdropLayer(sub);
    if (found) return found;
  }
  return nil;
}

// setBackdrop(handle: Buffer, blur: number, r, g, b, a: number) — replaces
// the vibrancy material's recipe (fixed blur + tint stack) with a plain
// gaussian blur of the given radius under a single solid tint. Keeps the
// NSVisualEffectView itself so behind-window compositing stays intact.
static napi_value SetBackdrop(napi_env env, napi_callback_info info) {
  size_t argc = 6;
  napi_value argv[6];
  napi_get_cb_info(env, info, &argc, argv, NULL, NULL);
  if (argc < 6) {
    napi_throw_error(env, NULL, "expected (handle, blur, r, g, b, a)");
    return NULL;
  }

  void* data = NULL;
  size_t length = 0;
  if (napi_get_buffer_info(env, argv[0], &data, &length) != napi_ok ||
      length < sizeof(NSView*)) {
    napi_throw_error(env, NULL, "handle must be the getNativeWindowHandle() Buffer");
    return NULL;
  }
  double blur = 0, r = 0, g = 0, b = 0, a = 0;
  napi_get_value_double(env, argv[1], &blur);
  napi_get_value_double(env, argv[2], &r);
  napi_get_value_double(env, argv[3], &g);
  napi_get_value_double(env, argv[4], &b);
  napi_get_value_double(env, argv[5], &a);

  NSView* view = *(NSView* __unsafe_unretained*)data;
  NSWindow* window = view.window;
  if (!window) return NULL;

  NSVisualEffectView* effectView = FindEffectView(window.contentView);
  if (!effectView) return NULL;

  // Pin the material to its active look so AppKit doesn't rebuild the recipe
  // (and revert our layers) when the window resigns key.
  effectView.state = NSVisualEffectStateActive;

  CALayer* backdrop = effectView.layer ? FindBackdropLayer(effectView.layer) : nil;
  if (!backdrop) return NULL;

  id filter = ((id (*)(id, SEL, id))objc_msgSend)(
      NSClassFromString(@"CAFilter"), NSSelectorFromString(@"filterWithType:"),
      @"gaussianBlur");
  [filter setValue:@(blur) forKey:@"inputRadius"];
  [filter setValue:@YES forKey:@"inputNormalizeEdges"];
  backdrop.filters = filter ? @[ filter ] : @[];

  // The material recipe stacks tint/frost layers next to the backdrop; hide
  // them and keep a single solid tint of our own above the blur.
  CALayer* parent = backdrop.superlayer;
  CALayer* tint = nil;
  for (CALayer* sub in parent.sublayers) {
    if ([sub.name isEqualToString:@"ds-tint"]) tint = sub;
    else if (sub != backdrop) sub.hidden = YES;
  }
  if (!tint) {
    tint = [CALayer layer];
    tint.name = @"ds-tint";
    tint.frame = parent.bounds;
    tint.autoresizingMask = kCALayerWidthSizable | kCALayerHeightSizable;
    [parent insertSublayer:tint above:backdrop];
  }
  tint.backgroundColor =
      [NSColor colorWithSRGBRed:(CGFloat)r green:(CGFloat)g blue:(CGFloat)b
                          alpha:(CGFloat)a].CGColor;
  return NULL;
}

static napi_value Init(napi_env env, napi_value exports) {
  napi_value fn;
  napi_create_function(env, "setCornerRadius", NAPI_AUTO_LENGTH, SetCornerRadius,
                       NULL, &fn);
  napi_set_named_property(env, exports, "setCornerRadius", fn);
  napi_create_function(env, "setBackdrop", NAPI_AUTO_LENGTH, SetBackdrop, NULL, &fn);
  napi_set_named_property(env, exports, "setBackdrop", fn);
  return exports;
}

NAPI_MODULE(corner_radius, Init)
