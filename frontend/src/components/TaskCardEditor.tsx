import { fieldDefinitions, type CardField, type TaskCard } from '../types';

interface Props {
  card: TaskCard;
  onChange: (field: CardField, value: string) => void;
  disabled?: boolean;
}

export default function TaskCardEditor({ card, onChange, disabled = false }: Props) {
  return (
    <div className="editor-grid">
      {fieldDefinitions.map(({ key, label, placeholder }) => {
        const long = !['title', 'topic', 'contact'].includes(key);
        return <label className={`field ${long ? 'field--wide' : ''}`} key={key}>
          <span>{label}</span>
          {long ? <textarea rows={3} value={card[key] ?? ''} placeholder={placeholder} disabled={disabled}
            onChange={(event) => onChange(key, event.target.value)} />
            : <input value={card[key] ?? ''} placeholder={placeholder} disabled={disabled}
              onChange={(event) => onChange(key, event.target.value)} />}
        </label>;
      })}
    </div>
  );
}
