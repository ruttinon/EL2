import { Icon } from '@iconify/react';
import { useState } from 'react';
import { SCENE_SCRIPT_EXAMPLES, exampleScriptJson } from './sceneScript/examples';
import { parseSceneScript } from './sceneScript/types';

export function SceneScriptPanel({
  disabled,
  busy,
  onRun,
  onDownloadBlender,
}: {
  disabled?: boolean;
  busy?: boolean;
  onRun: (scriptJson: string, mode: 'replace' | 'merge') => void;
  onDownloadBlender: () => void;
}) {
  const [exampleId, setExampleId] = useState('mcc-room');
  const [text, setText] = useState(() => exampleScriptJson('mcc-room'));
  const [parseError, setParseError] = useState<string | null>(null);

  function validate() {
    const result = parseSceneScript(text);
    if (!result.ok) {
      setParseError(result.error);
      return false;
    }
    setParseError(null);
    return true;
  }

  return (
    <div className="scene-script-panel">
      <div className="eq-3d-explainer">
        <b>Scene Script</b> — เขียน JSON สร้างห้อง + กำแพง + ตู้ GLB + สายไฟ (ไม่ต้องลากวางทีละชิ้น)
      </div>

      <p className="eq-hint scene-script-lead">
        แนะนำ: กำหนด <code>room</code> แล้วระบบสร้างพื้น + กำแพง 4 ด้านให้ · ตู้ <code>mcc</code>/<code>panel</code> สร้าง GLB จากขนาด mm
      </p>

      <label className="eq-field">ตัวอย่าง
        <select
          value={exampleId}
          onChange={(e) => {
            setExampleId(e.target.value);
            setText(exampleScriptJson(e.target.value));
            setParseError(null);
          }}
        >
          {SCENE_SCRIPT_EXAMPLES.map((ex) => (
            <option key={ex.id} value={ex.id}>{ex.label}</option>
          ))}
        </select>
      </label>

      <label className="eq-field">สคริป (JSON)
        <textarea
          className="scene-script-editor"
          rows={16}
          value={text}
          onChange={(e) => { setText(e.target.value); setParseError(null); }}
          spellCheck={false}
        />
      </label>

      {parseError ? <div className="alert error" style={{ fontSize: 12 }}>{parseError}</div> : null}

      <div className="button-row compact" style={{ flexWrap: 'wrap', gap: 6 }}>
        <button
          type="button"
          className="btn primary"
          disabled={disabled || busy}
          onClick={() => { if (validate()) onRun(text, 'replace'); }}
        >
          <Icon icon="solar:play-bold-duotone" width="16" height="16" />
          {busy ? 'กำลังสร้าง…' : 'สร้าง Scene (แทนที่)'}
        </button>
        <button
          type="button"
          className="btn secondary"
          disabled={disabled || busy}
          onClick={() => { if (validate()) onRun(text, 'merge'); }}
        >
          รวมกับ canvas
        </button>
        <button type="button" className="btn secondary tiny" onClick={onDownloadBlender}>
          Blender .py
        </button>
      </div>

      <p className="eq-hint" style={{ marginTop: 10 }}>
        ตู้ <code>mcc</code>/<code>panel</code> + <code>generateGlb: true</code> → สร้างไฟล์ GLB จริงจากขนาด mm<br />
        แก้ <code>equipment[].xMm/yMm</code> เป็นตำแหน่ง · <code>wires</code> ใช้ id เช่น <code>mcc1.out</code>
      </p>
    </div>
  );
}
