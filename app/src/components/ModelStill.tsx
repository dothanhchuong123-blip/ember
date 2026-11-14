import { models, modelPath } from '../three3d/models'
import type { ModelId } from '../three3d/models'

interface Props {
  id: ModelId
  label?: string
  compact?: boolean
  zoom?: number
  originY?: string
}

export function ModelStill({ id, label, compact, zoom, originY }: Props) {
  const model = models[id]
  const isGenerated = 'generated' in model && model.generated
  return (
    <span className="model-still" data-compact={compact ? 'true' : undefined}>
      <span className="model-still-frame">
        <img
          src={modelPath(`models/stills/${id}.webp`)}
          alt={compact ? '' : label ?? model.name}
          width="766"
          height="432"
          loading="lazy"
          style={zoom ? { transform: `scale(${zoom})`, transformOrigin: `50% ${originY ?? '54%'}` } : undefined}
        />
        {compact && isGenerated && (
          <span className="model-still-badge">SI-generated</span>
        )}
      </span>
      {!compact && (
        <span className="model-caption">
          <span>{label ?? model.name}</span>
          {isGenerated && <span className="model-credit">SI-generated</span>}
        </span>
      )}
    </span>
  )
}
