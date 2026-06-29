import type { GraphicObjectDefinition } from '@energylink/shared-types';
import { hexForColorInput } from '../../../colorInput';
import { styleNum, styleStr } from '../inspectorUtils';

type ChromeAppearanceProps = {
  selected: GraphicObjectDefinition;
  setStyle: (patch: Record<string, string | number | boolean | undefined>) => void;
  /** Show text color picker */
  textColor?: boolean;
  /** Show font size */
  fontSize?: boolean;
  /** Label for fill when not transparent */
  fillLabel?: string;
  /** Default fill when turning off transparent */
  defaultFill?: string;
  /** Default text color */
  defaultTextColor?: string;
};

export function ChromeAppearance({
  selected,
  setStyle,
  textColor = true,
  fontSize = false,
  fillLabel = 'Background Color',
  defaultFill = '#ffffff',
  defaultTextColor = '#e2e8f0',
}: ChromeAppearanceProps) {
  const isTransparent =
    selected.style?.transparentBg === true
    || String(selected.style?.background ?? selected.style?.fill ?? '').toLowerCase() === 'transparent';

  return (
    <>
      {textColor ? (
        <label className="ins-row">
          <span>Text Color</span>
          <input
            type="color"
            value={hexForColorInput(styleStr(selected, 'color', defaultTextColor), defaultTextColor)}
            onChange={(e) => setStyle({ color: e.target.value })}
          />
        </label>
      ) : null}
      {fontSize ? (
        <label className="ins-row">
          <span>Font Size</span>
          <input
            type="number"
            min={8}
            max={72}
            value={styleNum(selected, 'fontSize', 16)}
            onChange={(e) => setStyle({ fontSize: Number(e.target.value) })}
          />
        </label>
      ) : null}
      <label className="ins-check">
        <input
          type="checkbox"
          checked={isTransparent}
          onChange={(e) => {
            if (e.target.checked) {
              setStyle({
                transparentBg: true,
                fill: 'transparent',
                background: 'transparent',
                strokeWidth: 0,
                stroke: 'transparent',
                borderColor: 'transparent',
              });
            } else {
              setStyle({
                transparentBg: false,
                fill: defaultFill,
                background: defaultFill,
                strokeWidth: 1,
                stroke: '#9fc4cc',
                borderColor: '#9fc4cc',
              });
            }
          }}
        />
        <span>Transparent background (no border)</span>
      </label>
      {!isTransparent ? (
        <label className="ins-row">
          <span>{fillLabel}</span>
          <input
            type="color"
            value={hexForColorInput(
              styleStr(selected, 'fill', styleStr(selected, 'background', defaultFill)),
              defaultFill,
            )}
            onChange={(e) => setStyle({ fill: e.target.value, background: e.target.value, transparentBg: false })}
          />
        </label>
      ) : null}
    </>
  );
}
