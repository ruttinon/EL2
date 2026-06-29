import { DiagramLayer, type DiagramLayerProps } from './DiagramLayer';

/** HUD tier — data widgets that stay above diagram + world in 3D camera modes */
export function HudLayer(props: DiagramLayerProps) {
  return (
    <DiagramLayer
      {...props}
      className={props.className ? `uv-hud-layer ${props.className}` : 'uv-hud-layer'}
      stageClassName={props.stageClassName ?? 'uv-hud-stage-inner'}
      backgroundColor="transparent"
      backgroundImage={null}
    />
  );
}
