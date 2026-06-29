import { Icon } from '@iconify/react';

const AI_3D_LINKS = [
  { name: 'Tripo3D', url: 'https://www.tripo3d.ai/' },
  { name: 'Meshy', url: 'https://www.meshy.ai/' },
  { name: 'Rodin (Hyper3D)', url: 'https://hyper3d.ai/' },
];

export function ImageToModelGuide({
  onImportGlb,
}: {
  onImportGlb?: () => void;
}) {
  return (
    <div className="eq-3d-explainer image-to-model-guide">
      <b>รูp → โมเดล 3D จริง (GLB)</b>
      <p style={{ margin: '6px 0 8px', fontWeight: 400 }}>
        Editor <strong>ไม่มี AI สร้าง 3D จากรูp</strong> แบบ Tripo/Meshy — ต้องใช้เว็บภายนอกแล้ว import ไฟล์ .glb
      </p>
      <ol className="eq-model-steps">
        <li>อัปโหลดรูpไปเว็b AI ด้านล่าง → ดาวน์โหลด <code>.glb</code></li>
        <li>Setup → Assets → Import ไฟล์ GLB</li>
        <li>แท็บ Scene → ลากจาก <b>3D Models</b> ลง canvas</li>
        <li>โหมด 3D = <b>GLB</b> → กด Live หมุนดูได้</li>
      </ol>
      <div className="eq-ai-links">
        {AI_3D_LINKS.map((link) => (
          <a key={link.url} href={link.url} target="_blank" rel="noopener noreferrer" className="btn secondary tiny">
            <Icon icon="solar:link-bold-duotone" width="14" height="14" /> {link.name}
          </a>
        ))}
      </div>
      {onImportGlb ? (
        <button type="button" className="btn primary" style={{ width: '100%', marginTop: 8 }} onClick={onImportGlb}>
          <Icon icon="solar:upload-bold-duotone" width="16" height="16" /> Import ไฟล์ GLB (.glb)
        </button>
      ) : null}
    </div>
  );
}
