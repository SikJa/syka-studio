/** @jsxImportSource react */
import {useId} from "react";
import {RiFacebookCircleFill,RiInstagramLine,RiTiktokFill,RiTwitterXFill,RiYoutubeFill,RiLinkedinBoxFill} from "@remixicon/react";
type SocialPlatform="facebook"|"instagram"|"youtube"|"tiktok"|"linkedin"|"x";
export function PlatformIcon({ platform, size }: { platform: SocialPlatform; size: number }) {
  const gradientId = `instagram-${useId().replace(/:/g, "")}`;
  if(platform==='tiktok')return <RiTiktokFill size={size} aria-hidden="true"/>;
  if(platform==='x')return <RiTwitterXFill size={size} aria-hidden="true"/>;
  if(platform==='youtube')return <RiYoutubeFill size={size} aria-hidden="true" style={{color:'#ff0033'}}/>;
  if(platform==='linkedin')return <RiLinkedinBoxFill size={size} aria-hidden="true" style={{color:'#0a66c2'}}/>;
  if (platform === "facebook") return <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="#fff" /><RiFacebookCircleFill size={24} style={{ color: "#0866ff", fill: "#0866ff" }} /></svg>;
  return <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
    <defs><linearGradient id={gradientId} x1="0" y1="1" x2="1" y2="0"><stop offset="0" stopColor="#ffdc80" /><stop offset="0.3" stopColor="#fcaf45" /><stop offset="0.55" stopColor="#f77737" /><stop offset="0.75" stopColor="#e1306c" /><stop offset="1" stopColor="#833ab4" /></linearGradient></defs>
    <RiInstagramLine size={24} style={{ fill: `url(#${gradientId})` }} />
  </svg>;
}
