import { fieldDefinitions, type CardField, type TaskCard, type TopicOption } from '../types';

interface Props {
  card: TaskCard;
  onChange: (field: CardField, value: string) => void;
  topicOptions: TopicOption[];
  disabled?: boolean;
}

export default function TaskCardEditor({ card, onChange, topicOptions, disabled = false }: Props) {
  return (
    <div className="editor-grid">
      {fieldDefinitions.map(({ key, label, placeholder }) => {
        const long = !['title', 'topic', 'contact'].includes(key);
        return <label className={`field ${long ? 'field--wide' : ''}`} key={key}>
          <span>{label}</span>
          {key === 'topic'
            ? <select value={card.topic ?? ''} disabled={disabled || topicOptions.length === 0}
                onChange={(event) => onChange('topic', event.target.value)}>
                <option value="">Выберите тему</option>
                {topicOptions.map(({ slug, label: topicLabel }) => <option value={slug} key={slug}>{topicLabel}</option>)}
              </select>
            : long ? <textarea rows={3} value={card[key] ?? ''} placeholder={placeholder} disabled={disabled}
                onChange={(event) => onChange(key, event.target.value)} />
              : <input value={card[key] ?? ''} placeholder={placeholder} disabled={disabled}
                  onChange={(event) => onChange(key, event.target.value)} />}
        </label>;
      })}
    </div>
  );
}
