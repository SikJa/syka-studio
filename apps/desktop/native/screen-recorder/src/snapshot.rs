// Adapted from Whispera; MIT, see ../LICENSE-Whispera.
use crate::Region;
use serde::Serialize;
use image::{codecs::png::{CompressionType,FilterType,PngEncoder},ImageEncoder};
use base64::Engine;
use windows::Win32::Graphics::Gdi::*;
use windows::core::BOOL;
use windows::Win32::Foundation::{LPARAM,RECT};
struct CaptureDc {
    screen: HDC,
    memory: HDC,
    bitmap: HBITMAP,
    previous: Option<HGDIOBJ>,
}
impl Drop for CaptureDc {
    fn drop(&mut self) {
        unsafe {
            if let Some(previous) = self.previous.take() {
                SelectObject(self.memory, previous);
            }
            if !self.bitmap.is_invalid() {
                let _ = DeleteObject(HGDIOBJ(self.bitmap.0));
            }
            if !self.memory.is_invalid() {
                let _ = DeleteDC(self.memory);
            }
            if !self.screen.is_invalid() {
                ReleaseDC(None, self.screen);
            }
        }
    }
}
fn buffer_len(width: u32, height: u32) -> Result<usize, String> {
    let pixels = (width as usize)
        .checked_mul(height as usize)
        .ok_or("Captura demasiado grande")?;
    if width == 0
        || height == 0
        || width > i32::MAX as u32
        || height > i32::MAX as u32
        || pixels > 64 * 1024 * 1024
    {
        return Err("Dimensiones de captura invalidas".into());
    }
    pixels
        .checked_mul(4)
        .ok_or_else(|| "Captura demasiado grande".into())
}
fn opaque_rgba(bytes: &mut [u8]) {
    for pixel in bytes.chunks_exact_mut(4) {
        pixel.swap(0, 2);
        pixel[3] = 255;
    }
}
pub fn png(region: Region) -> Result<Vec<u8>, String> {
    let mut bytes = vec![0; buffer_len(region.width, region.height)?];
    unsafe {
        // Commit pending hide/show changes so repeated captures never include old ink.
        windows::Win32::Graphics::Dwm::DwmFlush().map_err(|e| e.to_string())?;
        let mut dc = CaptureDc {
            screen: GetDC(None),
            memory: HDC::default(),
            bitmap: HBITMAP::default(),
            previous: None,
        };
        if dc.screen.is_invalid() {
            return Err("No se pudo acceder a la pantalla".into());
        }
        dc.memory = CreateCompatibleDC(Some(dc.screen));
        if dc.memory.is_invalid() {
            return Err("No se pudo preparar la captura".into());
        }
        dc.bitmap = CreateCompatibleBitmap(dc.screen, region.width as i32, region.height as i32);
        if dc.bitmap.is_invalid() {
            return Err("No se pudo preparar la imagen".into());
        }
        let previous = SelectObject(dc.memory, HGDIOBJ(dc.bitmap.0));
        if previous.is_invalid() {
            return Err("No se pudo seleccionar la imagen".into());
        }
        dc.previous = Some(previous);
        BitBlt(
            dc.memory,
            0,
            0,
            region.width as i32,
            region.height as i32,
            Some(dc.screen),
            region.x,
            region.y,
            SRCCOPY | CAPTUREBLT,
        )
        .map_err(|e| e.to_string())?;
        // GetDIBits requires the bitmap to be deselected from the memory DC.
        SelectObject(dc.memory, previous);
        dc.previous = None;
        let mut info = BITMAPINFO {
            bmiHeader: BITMAPINFOHEADER {
                biSize: std::mem::size_of::<BITMAPINFOHEADER>() as u32,
                biWidth: region.width as i32,
                biHeight: -(region.height as i32),
                biPlanes: 1,
                biBitCount: 32,
                biCompression: BI_RGB.0,
                ..Default::default()
            },
            ..Default::default()
        };
        if GetDIBits(
            dc.screen,
            dc.bitmap,
            0,
            region.height,
            Some(bytes.as_mut_ptr().cast()),
            &mut info,
            DIB_RGB_COLORS,
        ) != region.height as i32
        {
            return Err("No se pudieron leer todos los pixeles".into());
        }
    }
    opaque_rgba(&mut bytes);
    let mut png = Vec::new();
    PngEncoder::new_with_quality(&mut png, CompressionType::Fast, FilterType::Sub)
        .write_image(
            &bytes,
            region.width,
            region.height,
            image::ExtendedColorType::Rgba8,
        )
        .map_err(|e| e.to_string())?;
    Ok(png)
}
#[derive(Serialize)]
pub struct Source { id:String, name:String, thumbnail:String, kind:&'static str, bounds:Region }
unsafe extern "system" fn monitor(handle:HMONITOR,_:HDC,rect:*mut RECT,data:LPARAM)->BOOL {
 let list=&mut *(data.0 as *mut Vec<(isize,Region)>);let r=*rect;
 list.push((handle.0 as isize,Region{x:r.left,y:r.top,width:(r.right-r.left)as u32,height:(r.bottom-r.top)as u32}));BOOL(1)
}
pub fn sources()->Result<Vec<Source>,String>{
 let mut monitors=Vec::<(isize,Region)>::new();
 unsafe{let _=EnumDisplayMonitors(None,None,Some(monitor),LPARAM(&mut monitors as *mut _ as isize));}
 monitors.sort_by_key(|(_,r)|(r.x,r.y));
 monitors.iter().enumerate().map(|(i,(id,bounds))|{
 let full=png(*bounds)?;let img=image::load_from_memory(&full).map_err(|e|e.to_string())?.resize(640,360,image::imageops::FilterType::Triangle).to_rgba8();let mut thumb=Vec::new();
 PngEncoder::new(&mut thumb).write_image(img.as_raw(),img.width(),img.height(),image::ExtendedColorType::Rgba8).map_err(|e|e.to_string())?;
 Ok(Source{id:format!("screen:{}",id),name:format!("Pantalla {}",i+1),thumbnail:format!("data:image/png;base64,{}",base64::engine::general_purpose::STANDARD.encode(thumb)),kind:"screen",bounds:*bounds})
 }).collect()
}
