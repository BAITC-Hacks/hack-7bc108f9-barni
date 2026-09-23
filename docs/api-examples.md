# Примеры API (реальные ответы)

Сняты с работающего стека (`docker compose up -d --build`, ключ OpenAI задан)
на чистой базе, в порядке демо-сценария tz.md §20. Контракт — `docs/api-contract.md`.
UUID и даты у вас будут другими; формулировки AI-вопросов меняются от запуска к запуску.

## Системные и справочники

### Health

`GET /health` → **200**

Ответ:
```json
{
  "status": "ok"
}
```

### Справочники

`GET /api/meta` → **200**

Ответ:
```json
{
  "topics": [
    {
      "slug": "automation",
      "label": "Автоматизация"
    },
    {
      "slug": "analytics",
      "label": "Аналитика"
    },
    {
      "slug": "marketing",
      "label": "Маркетинг"
    },
    {
      "slug": "education",
      "label": "Образование"
    },
    {
      "slug": "finance",
      "label": "Финансы"
    },
    {
      "slug": "other",
      "label": "Другое"
    }
  ],
  "readiness_levels": [
    {
      "slug": "draft",
      "label": "Черновик",
      "min": 0,
      "max": 39
    },
    {
      "slug": "working",
      "label": "Рабочая",
      "min": 40,
      "max": 69
    },
    {
      "slug": "ready",
      "label": "Готовая",
      "min": 70,
      "max": 89
    },
    {
      "slug": "priority",
      "label": "Приоритетная",
      "min": 90,
      "max": 100
    }
  ]
}
```

### Команды для переключателя ролей

`GET /api/teams` → **200**

Ответ:
```json
[
  {
    "id": "00000000-0000-4000-8000-000000000001",
    "name": "Team Alpha",
    "interests": [
      "automation",
      "analytics"
    ],
    "skills": [
      "Python",
      "React"
    ],
    "technologies": [
      "FastAPI",
      "PostgreSQL"
    ],
    "points": 0
  },
  {
    "id": "00000000-0000-4000-8000-000000000002",
    "name": "Team Beta",
    "interests": [
      "marketing",
      "education"
    ],
    "skills": [
      "UX",
      "TypeScript"
    ],
    "technologies": [
      "React",
      "Figma"
    ],
    "points": 0
  },
  {
    "id": "00000000-0000-4000-8000-000000000003",
    "name": "Team Gamma",
    "interests": [
      "finance",
      "other"
    ],
    "skills": [
      "Data analysis",
      "ML"
    ],
    "technologies": [
      "Pandas",
      "Jupyter"
    ],
    "points": 0
  }
]
```

## AI

### Анализ черновика

`POST /api/ai/analyze-draft` → **200**

Запрос:
```json
{
  "draft": "Хотим улучшить обработку заявок клиентов",
  "topic": "automation"
}
```

Ответ:
```json
{
  "known_fields": {
    "topic": "automation",
    "need": "Хотим улучшить обработку заявок клиентов"
  },
  "missing_fields": [
    "title",
    "context",
    "users",
    "data",
    "constraints",
    "expected_result",
    "success_criteria",
    "contact",
    "interaction_format"
  ],
  "questions": [
    {
      "id": "q1",
      "target_field": "context",
      "text": "Как описывается текущий процесс обработки заявок клиентов?"
    },
    {
      "id": "q2",
      "target_field": "users",
      "text": "Кто именно будет использовать предлагаемые улучшения в обработке заявок клиентов?"
    },
    {
      "id": "q3",
      "target_field": "data",
      "text": "Какие данные или материалы доступны для анализа и улучшения обработки заявок?"
    },
    {
      "id": "q4",
      "target_field": "expected_result",
      "text": "Какой конкретный результат ожидается от улучшения обработки заявок клиентов?"
    },
    {
      "id": "q5",
      "target_field": "success_criteria",
      "text": "Какие критерии будут использоваться для оценки успешности улучшения обработки заявок?"
    }
  ],
  "source": "model"
}
```

### Сборка карточки (questions — те же, что вернул analyze-draft)

`POST /api/ai/build-card` → **200**

Запрос:
```json
{
  "draft": "Хотим улучшить обработку заявок клиентов",
  "topic": "automation",
  "questions": [
    {
      "id": "q1",
      "target_field": "context",
      "text": "Как описывается текущий процесс обработки заявок клиентов?"
    },
    {
      "id": "q2",
      "target_field": "users",
      "text": "Кто именно будет использовать предлагаемые улучшения в обработке заявок клиентов?"
    },
    {
      "id": "q3",
      "target_field": "data",
      "text": "Какие данные или материалы доступны для анализа и улучшения обработки заявок?"
    },
    {
      "id": "q4",
      "target_field": "expected_result",
      "text": "Какой конкретный результат ожидается от улучшения обработки заявок клиентов?"
    },
    {
      "id": "q5",
      "target_field": "success_criteria",
      "text": "Какие критерии будут использоваться для оценки успешности улучшения обработки заявок?"
    }
  ],
  "answers": [
    {
      "question_id": "q1",
      "answer": "Заявки приходят в WhatsApp и обрабатываются вручную"
    }
  ]
}
```

Ответ:
```json
{
  "card": {
    "title": null,
    "topic": "automation",
    "context": "Заявки приходят в WhatsApp и обрабатываются вручную",
    "need": "Хотим улучшить обработку заявок клиентов",
    "users": null,
    "data": null,
    "constraints": null,
    "expected_result": null,
    "success_criteria": null,
    "contact": null,
    "interaction_format": null
  },
  "source": "model"
}
```

## Задачи и рейтинг

### Создать черновик

`POST /api/tasks` → **201**

Запрос:
```json
{
  "draft_text": "Хотим улучшить обработку заявок клиентов",
  "topic": "automation"
}
```

Ответ:
```json
{
  "id": "e7d1bd2f-c081-49c2-814e-b7570a1258e6",
  "status": "draft",
  "draft_text": "Хотим улучшить обработку заявок клиентов",
  "title": null,
  "topic": "automation",
  "card": {
    "title": null,
    "topic": "automation",
    "context": null,
    "need": null,
    "users": null,
    "data": null,
    "constraints": null,
    "expected_result": null,
    "success_criteria": null,
    "contact": null,
    "interaction_format": null
  },
  "score": null,
  "readiness_level": null,
  "score_breakdown": null,
  "missing_fields": null,
  "confirmed_at": null,
  "published_at": null,
  "created_at": "2026-09-23T11:09:56.754529Z",
  "updated_at": "2026-09-23T11:09:56.754529Z",
  "proposals_count": 0
}
```

### Опубликовать до подтверждения

`POST /api/tasks/e7d1bd2f-c081-49c2-814e-b7570a1258e6/publish` → **409**

Ответ:
```json
{
  "error": {
    "code": "TASK_NOT_CONFIRMED",
    "message": "Сначала подтвердите карточку задачи"
  }
}
```

### Предварительный рейтинг (ничего не сохраняет); пустые строки считаются null

`POST /api/rating/preview` → **200**

Запрос:
```json
{
  "card": {
    "title": "Оптимизация обработки заявок",
    "topic": "automation",
    "context": "Заявки приходят в WhatsApp и обрабатываются вручную",
    "need": "Сократить время обработки заявок",
    "data": "",
    "users": "  "
  }
}
```

Ответ:
```json
{
  "score": 20,
  "readiness_level": "draft",
  "breakdown": [
    {
      "field": "context",
      "label": "Контекст",
      "earned": 10,
      "maximum": 10,
      "reason": "Контекст: указано"
    },
    {
      "field": "need",
      "label": "Потребность",
      "earned": 10,
      "maximum": 10,
      "reason": "Потребность: указано"
    },
    {
      "field": "data",
      "label": "Данные и материалы",
      "earned": 0,
      "maximum": 20,
      "reason": "Данные и материалы: не указано"
    },
    {
      "field": "expected_result",
      "label": "Ожидаемый результат",
      "earned": 0,
      "maximum": 15,
      "reason": "Ожидаемый результат: не указано"
    },
    {
      "field": "success_criteria",
      "label": "Критерии успеха",
      "earned": 0,
      "maximum": 15,
      "reason": "Критерии успеха: не указано"
    },
    {
      "field": "constraints",
      "label": "Ограничения",
      "earned": 0,
      "maximum": 10,
      "reason": "Ограничения: не указано"
    },
    {
      "field": "users",
      "label": "Пользователи",
      "earned": 0,
      "maximum": 10,
      "reason": "Пользователи: не указано"
    },
    {
      "field": "contact",
      "label": "Контакт",
      "earned": 0,
      "maximum": 5,
      "reason": "Контакт: не указано"
    },
    {
      "field": "interaction_format",
      "label": "Формат взаимодействия",
      "earned": 0,
      "maximum": 5,
      "reason": "Формат взаимодействия: не указано"
    }
  ],
  "missing_fields": [
    {
      "field": "data",
      "label": "Данные и материалы",
      "potential_points": 20,
      "recommendation": "Укажите, какие данные и материалы получит команда"
    },
    {
      "field": "expected_result",
      "label": "Ожидаемый результат",
      "potential_points": 15,
      "recommendation": "Опишите результат, который должна подготовить команда"
    },
    {
      "field": "success_criteria",
      "label": "Критерии успеха",
      "potential_points": 15,
      "recommendation": "Добавьте измеримые признаки успешного результата"
    },
    {
      "field": "constraints",
      "label": "Ограничения",
      "potential_points": 10,
      "recommendation": "Укажите сроки, технологии, доступы и другие ограничения"
    },
    {
      "field": "users",
      "label": "Пользователи",
      "potential_points": 10,
      "recommendation": "Укажите, для кого создаётся решение"
    },
    {
      "field": "contact",
      "label": "Контакт",
      "potential_points": 5,
      "recommendation": "Добавьте контакт представителя бизнеса"
    },
    {
      "field": "interaction_format",
      "label": "Формат взаимодействия",
      "potential_points": 5,
      "recommendation": "Опишите формат консультаций и обратной связи"
    }
  ]
}
```

### Подтвердить частичную карточку

`PUT /api/tasks/e7d1bd2f-c081-49c2-814e-b7570a1258e6/confirm` → **200**

Запрос:
```json
{
  "card": {
    "title": "Оптимизация обработки заявок",
    "topic": "automation",
    "context": "Заявки приходят в WhatsApp и обрабатываются вручную",
    "need": "Сократить время обработки заявок",
    "data": "",
    "users": "  "
  }
}
```

Ответ:
```json
{
  "id": "e7d1bd2f-c081-49c2-814e-b7570a1258e6",
  "status": "draft",
  "draft_text": "Хотим улучшить обработку заявок клиентов",
  "title": "Оптимизация обработки заявок",
  "topic": "automation",
  "card": {
    "title": "Оптимизация обработки заявок",
    "topic": "automation",
    "context": "Заявки приходят в WhatsApp и обрабатываются вручную",
    "need": "Сократить время обработки заявок",
    "users": null,
    "data": null,
    "constraints": null,
    "expected_result": null,
    "success_criteria": null,
    "contact": null,
    "interaction_format": null
  },
  "score": 20,
  "readiness_level": "draft",
  "score_breakdown": [
    {
      "field": "context",
      "label": "Контекст",
      "earned": 10,
      "maximum": 10,
      "reason": "Контекст: указано"
    },
    {
      "field": "need",
      "label": "Потребность",
      "earned": 10,
      "maximum": 10,
      "reason": "Потребность: указано"
    },
    {
      "field": "data",
      "label": "Данные и материалы",
      "earned": 0,
      "maximum": 20,
      "reason": "Данные и материалы: не указано"
    },
    {
      "field": "expected_result",
      "label": "Ожидаемый результат",
      "earned": 0,
      "maximum": 15,
      "reason": "Ожидаемый результат: не указано"
    },
    {
      "field": "success_criteria",
      "label": "Критерии успеха",
      "earned": 0,
      "maximum": 15,
      "reason": "Критерии успеха: не указано"
    },
    {
      "field": "constraints",
      "label": "Ограничения",
      "earned": 0,
      "maximum": 10,
      "reason": "Ограничения: не указано"
    },
    {
      "field": "users",
      "label": "Пользователи",
      "earned": 0,
      "maximum": 10,
      "reason": "Пользователи: не указано"
    },
    {
      "field": "contact",
      "label": "Контакт",
      "earned": 0,
      "maximum": 5,
      "reason": "Контакт: не указано"
    },
    {
      "field": "interaction_format",
      "label": "Формат взаимодействия",
      "earned": 0,
      "maximum": 5,
      "reason": "Формат взаимодействия: не указано"
    }
  ],
  "missing_fields": [
    {
      "field": "data",
      "label": "Данные и материалы",
      "potential_points": 20,
      "recommendation": "Укажите, какие данные и материалы получит команда"
    },
    {
      "field": "expected_result",
      "label": "Ожидаемый результат",
      "potential_points": 15,
      "recommendation": "Опишите результат, который должна подготовить команда"
    },
    {
      "field": "success_criteria",
      "label": "Критерии успеха",
      "potential_points": 15,
      "recommendation": "Добавьте измеримые признаки успешного результата"
    },
    {
      "field": "constraints",
      "label": "Ограничения",
      "potential_points": 10,
      "recommendation": "Укажите сроки, технологии, доступы и другие ограничения"
    },
    {
      "field": "users",
      "label": "Пользователи",
      "potential_points": 10,
      "recommendation": "Укажите, для кого создаётся решение"
    },
    {
      "field": "contact",
      "label": "Контакт",
      "potential_points": 5,
      "recommendation": "Добавьте контакт представителя бизнеса"
    },
    {
      "field": "interaction_format",
      "label": "Формат взаимодействия",
      "potential_points": 5,
      "recommendation": "Опишите формат консультаций и обратной связи"
    }
  ],
  "confirmed_at": "2026-09-23T11:09:57.004559Z",
  "published_at": null,
  "created_at": "2026-09-23T11:09:56.754529Z",
  "updated_at": "2026-09-23T11:09:57.002504Z",
  "proposals_count": 0
}
```

### Опубликовать

`POST /api/tasks/e7d1bd2f-c081-49c2-814e-b7570a1258e6/publish` → **200**

Ответ:
```json
{
  "id": "e7d1bd2f-c081-49c2-814e-b7570a1258e6",
  "status": "published",
  "draft_text": "Хотим улучшить обработку заявок клиентов",
  "title": "Оптимизация обработки заявок",
  "topic": "automation",
  "card": {
    "title": "Оптимизация обработки заявок",
    "topic": "automation",
    "context": "Заявки приходят в WhatsApp и обрабатываются вручную",
    "need": "Сократить время обработки заявок",
    "users": null,
    "data": null,
    "constraints": null,
    "expected_result": null,
    "success_criteria": null,
    "contact": null,
    "interaction_format": null
  },
  "score": 20,
  "readiness_level": "draft",
  "score_breakdown": [
    {
      "field": "context",
      "label": "Контекст",
      "earned": 10,
      "maximum": 10,
      "reason": "Контекст: указано"
    },
    {
      "field": "need",
      "label": "Потребность",
      "earned": 10,
      "maximum": 10,
      "reason": "Потребность: указано"
    },
    {
      "field": "data",
      "label": "Данные и материалы",
      "earned": 0,
      "maximum": 20,
      "reason": "Данные и материалы: не указано"
    },
    {
      "field": "expected_result",
      "label": "Ожидаемый результат",
      "earned": 0,
      "maximum": 15,
      "reason": "Ожидаемый результат: не указано"
    },
    {
      "field": "success_criteria",
      "label": "Критерии успеха",
      "earned": 0,
      "maximum": 15,
      "reason": "Критерии успеха: не указано"
    },
    {
      "field": "constraints",
      "label": "Ограничения",
      "earned": 0,
      "maximum": 10,
      "reason": "Ограничения: не указано"
    },
    {
      "field": "users",
      "label": "Пользователи",
      "earned": 0,
      "maximum": 10,
      "reason": "Пользователи: не указано"
    },
    {
      "field": "contact",
      "label": "Контакт",
      "earned": 0,
      "maximum": 5,
      "reason": "Контакт: не указано"
    },
    {
      "field": "interaction_format",
      "label": "Формат взаимодействия",
      "earned": 0,
      "maximum": 5,
      "reason": "Формат взаимодействия: не указано"
    }
  ],
  "missing_fields": [
    {
      "field": "data",
      "label": "Данные и материалы",
      "potential_points": 20,
      "recommendation": "Укажите, какие данные и материалы получит команда"
    },
    {
      "field": "expected_result",
      "label": "Ожидаемый результат",
      "potential_points": 15,
      "recommendation": "Опишите результат, который должна подготовить команда"
    },
    {
      "field": "success_criteria",
      "label": "Критерии успеха",
      "potential_points": 15,
      "recommendation": "Добавьте измеримые признаки успешного результата"
    },
    {
      "field": "constraints",
      "label": "Ограничения",
      "potential_points": 10,
      "recommendation": "Укажите сроки, технологии, доступы и другие ограничения"
    },
    {
      "field": "users",
      "label": "Пользователи",
      "potential_points": 10,
      "recommendation": "Укажите, для кого создаётся решение"
    },
    {
      "field": "contact",
      "label": "Контакт",
      "potential_points": 5,
      "recommendation": "Добавьте контакт представителя бизнеса"
    },
    {
      "field": "interaction_format",
      "label": "Формат взаимодействия",
      "potential_points": 5,
      "recommendation": "Опишите формат консультаций и обратной связи"
    }
  ],
  "confirmed_at": "2026-09-23T11:09:57.004559Z",
  "published_at": "2026-09-23T11:09:57.099188Z",
  "created_at": "2026-09-23T11:09:56.754529Z",
  "updated_at": "2026-09-23T11:09:57.097241Z",
  "proposals_count": 0
}
```

### Повторная публикация — ничего не меняет

`POST /api/tasks/e7d1bd2f-c081-49c2-814e-b7570a1258e6/publish` → **200**

Ответ:
```json
{
  "id": "e7d1bd2f-c081-49c2-814e-b7570a1258e6",
  "status": "published",
  "draft_text": "Хотим улучшить обработку заявок клиентов",
  "title": "Оптимизация обработки заявок",
  "topic": "automation",
  "card": {
    "title": "Оптимизация обработки заявок",
    "topic": "automation",
    "context": "Заявки приходят в WhatsApp и обрабатываются вручную",
    "need": "Сократить время обработки заявок",
    "users": null,
    "data": null,
    "constraints": null,
    "expected_result": null,
    "success_criteria": null,
    "contact": null,
    "interaction_format": null
  },
  "score": 20,
  "readiness_level": "draft",
  "score_breakdown": [
    {
      "field": "context",
      "label": "Контекст",
      "earned": 10,
      "maximum": 10,
      "reason": "Контекст: указано"
    },
    {
      "field": "need",
      "label": "Потребность",
      "earned": 10,
      "maximum": 10,
      "reason": "Потребность: указано"
    },
    {
      "field": "data",
      "label": "Данные и материалы",
      "earned": 0,
      "maximum": 20,
      "reason": "Данные и материалы: не указано"
    },
    {
      "field": "expected_result",
      "label": "Ожидаемый результат",
      "earned": 0,
      "maximum": 15,
      "reason": "Ожидаемый результат: не указано"
    },
    {
      "field": "success_criteria",
      "label": "Критерии успеха",
      "earned": 0,
      "maximum": 15,
      "reason": "Критерии успеха: не указано"
    },
    {
      "field": "constraints",
      "label": "Ограничения",
      "earned": 0,
      "maximum": 10,
      "reason": "Ограничения: не указано"
    },
    {
      "field": "users",
      "label": "Пользователи",
      "earned": 0,
      "maximum": 10,
      "reason": "Пользователи: не указано"
    },
    {
      "field": "contact",
      "label": "Контакт",
      "earned": 0,
      "maximum": 5,
      "reason": "Контакт: не указано"
    },
    {
      "field": "interaction_format",
      "label": "Формат взаимодействия",
      "earned": 0,
      "maximum": 5,
      "reason": "Формат взаимодействия: не указано"
    }
  ],
  "missing_fields": [
    {
      "field": "data",
      "label": "Данные и материалы",
      "potential_points": 20,
      "recommendation": "Укажите, какие данные и материалы получит команда"
    },
    {
      "field": "expected_result",
      "label": "Ожидаемый результат",
      "potential_points": 15,
      "recommendation": "Опишите результат, который должна подготовить команда"
    },
    {
      "field": "success_criteria",
      "label": "Критерии успеха",
      "potential_points": 15,
      "recommendation": "Добавьте измеримые признаки успешного результата"
    },
    {
      "field": "constraints",
      "label": "Ограничения",
      "potential_points": 10,
      "recommendation": "Укажите сроки, технологии, доступы и другие ограничения"
    },
    {
      "field": "users",
      "label": "Пользователи",
      "potential_points": 10,
      "recommendation": "Укажите, для кого создаётся решение"
    },
    {
      "field": "contact",
      "label": "Контакт",
      "potential_points": 5,
      "recommendation": "Добавьте контакт представителя бизнеса"
    },
    {
      "field": "interaction_format",
      "label": "Формат взаимодействия",
      "potential_points": 5,
      "recommendation": "Опишите формат консультаций и обратной связи"
    }
  ],
  "confirmed_at": "2026-09-23T11:09:57.004559Z",
  "published_at": "2026-09-23T11:09:57.099188Z",
  "created_at": "2026-09-23T11:09:56.754529Z",
  "updated_at": "2026-09-23T11:09:57.097241Z",
  "proposals_count": 0
}
```

### Получить задачу

`GET /api/tasks/e7d1bd2f-c081-49c2-814e-b7570a1258e6` → **200**

Ответ:
```json
{
  "id": "e7d1bd2f-c081-49c2-814e-b7570a1258e6",
  "status": "published",
  "draft_text": "Хотим улучшить обработку заявок клиентов",
  "title": "Оптимизация обработки заявок",
  "topic": "automation",
  "card": {
    "title": "Оптимизация обработки заявок",
    "topic": "automation",
    "context": "Заявки приходят в WhatsApp и обрабатываются вручную",
    "need": "Сократить время обработки заявок",
    "users": null,
    "data": null,
    "constraints": null,
    "expected_result": null,
    "success_criteria": null,
    "contact": null,
    "interaction_format": null
  },
  "score": 20,
  "readiness_level": "draft",
  "score_breakdown": [
    {
      "field": "context",
      "label": "Контекст",
      "earned": 10,
      "maximum": 10,
      "reason": "Контекст: указано"
    },
    {
      "field": "need",
      "label": "Потребность",
      "earned": 10,
      "maximum": 10,
      "reason": "Потребность: указано"
    },
    {
      "field": "data",
      "label": "Данные и материалы",
      "earned": 0,
      "maximum": 20,
      "reason": "Данные и материалы: не указано"
    },
    {
      "field": "expected_result",
      "label": "Ожидаемый результат",
      "earned": 0,
      "maximum": 15,
      "reason": "Ожидаемый результат: не указано"
    },
    {
      "field": "success_criteria",
      "label": "Критерии успеха",
      "earned": 0,
      "maximum": 15,
      "reason": "Критерии успеха: не указано"
    },
    {
      "field": "constraints",
      "label": "Ограничения",
      "earned": 0,
      "maximum": 10,
      "reason": "Ограничения: не указано"
    },
    {
      "field": "users",
      "label": "Пользователи",
      "earned": 0,
      "maximum": 10,
      "reason": "Пользователи: не указано"
    },
    {
      "field": "contact",
      "label": "Контакт",
      "earned": 0,
      "maximum": 5,
      "reason": "Контакт: не указано"
    },
    {
      "field": "interaction_format",
      "label": "Формат взаимодействия",
      "earned": 0,
      "maximum": 5,
      "reason": "Формат взаимодействия: не указано"
    }
  ],
  "missing_fields": [
    {
      "field": "data",
      "label": "Данные и материалы",
      "potential_points": 20,
      "recommendation": "Укажите, какие данные и материалы получит команда"
    },
    {
      "field": "expected_result",
      "label": "Ожидаемый результат",
      "potential_points": 15,
      "recommendation": "Опишите результат, который должна подготовить команда"
    },
    {
      "field": "success_criteria",
      "label": "Критерии успеха",
      "potential_points": 15,
      "recommendation": "Добавьте измеримые признаки успешного результата"
    },
    {
      "field": "constraints",
      "label": "Ограничения",
      "potential_points": 10,
      "recommendation": "Укажите сроки, технологии, доступы и другие ограничения"
    },
    {
      "field": "users",
      "label": "Пользователи",
      "potential_points": 10,
      "recommendation": "Укажите, для кого создаётся решение"
    },
    {
      "field": "contact",
      "label": "Контакт",
      "potential_points": 5,
      "recommendation": "Добавьте контакт представителя бизнеса"
    },
    {
      "field": "interaction_format",
      "label": "Формат взаимодействия",
      "potential_points": 5,
      "recommendation": "Опишите формат консультаций и обратной связи"
    }
  ],
  "confirmed_at": "2026-09-23T11:09:57.004559Z",
  "published_at": "2026-09-23T11:09:57.099188Z",
  "created_at": "2026-09-23T11:09:56.754529Z",
  "updated_at": "2026-09-23T11:09:57.097241Z",
  "proposals_count": 0
}
```

## Каталог

Опубликована ещё одна задача «Дашборд продаж» (70 баллов, analytics) тем же способом.

### Каталог: задача с 20 баллами ниже задачи с 70

`GET /api/tasks` → **200**

Ответ:
```json
[
  {
    "id": "02f20cd0-399b-40ed-b8be-825a2934e3b9",
    "title": "Дашборд продаж",
    "topic": "analytics",
    "context_preview": "Отчёты собираются вручную",
    "score": 70,
    "readiness_level": "ready",
    "missing_fields": [
      {
        "field": "constraints",
        "label": "Ограничения",
        "potential_points": 10,
        "recommendation": "Укажите сроки, технологии, доступы и другие ограничения"
      },
      {
        "field": "users",
        "label": "Пользователи",
        "potential_points": 10,
        "recommendation": "Укажите, для кого создаётся решение"
      },
      {
        "field": "contact",
        "label": "Контакт",
        "potential_points": 5,
        "recommendation": "Добавьте контакт представителя бизнеса"
      },
      {
        "field": "interaction_format",
        "label": "Формат взаимодействия",
        "potential_points": 5,
        "recommendation": "Опишите формат консультаций и обратной связи"
      }
    ],
    "status": "published",
    "published_at": "2026-09-23T11:09:57.360714Z",
    "proposals_count": 0
  },
  {
    "id": "e7d1bd2f-c081-49c2-814e-b7570a1258e6",
    "title": "Оптимизация обработки заявок",
    "topic": "automation",
    "context_preview": "Заявки приходят в WhatsApp и обрабатываются вручную",
    "score": 20,
    "readiness_level": "draft",
    "missing_fields": [
      {
        "field": "data",
        "label": "Данные и материалы",
        "potential_points": 20,
        "recommendation": "Укажите, какие данные и материалы получит команда"
      },
      {
        "field": "expected_result",
        "label": "Ожидаемый результат",
        "potential_points": 15,
        "recommendation": "Опишите результат, который должна подготовить команда"
      },
      {
        "field": "success_criteria",
        "label": "Критерии успеха",
        "potential_points": 15,
        "recommendation": "Добавьте измеримые признаки успешного результата"
      },
      {
        "field": "constraints",
        "label": "Ограничения",
        "potential_points": 10,
        "recommendation": "Укажите сроки, технологии, доступы и другие ограничения"
      },
      {
        "field": "users",
        "label": "Пользователи",
        "potential_points": 10,
        "recommendation": "Укажите, для кого создаётся решение"
      },
      {
        "field": "contact",
        "label": "Контакт",
        "potential_points": 5,
        "recommendation": "Добавьте контакт представителя бизнеса"
      },
      {
        "field": "interaction_format",
        "label": "Формат взаимодействия",
        "potential_points": 5,
        "recommendation": "Опишите формат консультаций и обратной связи"
      }
    ],
    "status": "published",
    "published_at": "2026-09-23T11:09:57.099188Z",
    "proposals_count": 0
  }
]
```

### Фильтр по теме

`GET /api/tasks?topic=automation` → **200**

Ответ:
```json
[
  {
    "id": "e7d1bd2f-c081-49c2-814e-b7570a1258e6",
    "title": "Оптимизация обработки заявок",
    "topic": "automation",
    "context_preview": "Заявки приходят в WhatsApp и обрабатываются вручную",
    "score": 20,
    "readiness_level": "draft",
    "missing_fields": [
      {
        "field": "data",
        "label": "Данные и материалы",
        "potential_points": 20,
        "recommendation": "Укажите, какие данные и материалы получит команда"
      },
      {
        "field": "expected_result",
        "label": "Ожидаемый результат",
        "potential_points": 15,
        "recommendation": "Опишите результат, который должна подготовить команда"
      },
      {
        "field": "success_criteria",
        "label": "Критерии успеха",
        "potential_points": 15,
        "recommendation": "Добавьте измеримые признаки успешного результата"
      },
      {
        "field": "constraints",
        "label": "Ограничения",
        "potential_points": 10,
        "recommendation": "Укажите сроки, технологии, доступы и другие ограничения"
      },
      {
        "field": "users",
        "label": "Пользователи",
        "potential_points": 10,
        "recommendation": "Укажите, для кого создаётся решение"
      },
      {
        "field": "contact",
        "label": "Контакт",
        "potential_points": 5,
        "recommendation": "Добавьте контакт представителя бизнеса"
      },
      {
        "field": "interaction_format",
        "label": "Формат взаимодействия",
        "potential_points": 5,
        "recommendation": "Опишите формат консультаций и обратной связи"
      }
    ],
    "status": "published",
    "published_at": "2026-09-23T11:09:57.099188Z",
    "proposals_count": 0
  }
]
```

### Фильтр по уровню

`GET /api/tasks?readiness=ready` → **200**

Ответ:
```json
[
  {
    "id": "02f20cd0-399b-40ed-b8be-825a2934e3b9",
    "title": "Дашборд продаж",
    "topic": "analytics",
    "context_preview": "Отчёты собираются вручную",
    "score": 70,
    "readiness_level": "ready",
    "missing_fields": [
      {
        "field": "constraints",
        "label": "Ограничения",
        "potential_points": 10,
        "recommendation": "Укажите сроки, технологии, доступы и другие ограничения"
      },
      {
        "field": "users",
        "label": "Пользователи",
        "potential_points": 10,
        "recommendation": "Укажите, для кого создаётся решение"
      },
      {
        "field": "contact",
        "label": "Контакт",
        "potential_points": 5,
        "recommendation": "Добавьте контакт представителя бизнеса"
      },
      {
        "field": "interaction_format",
        "label": "Формат взаимодействия",
        "potential_points": 5,
        "recommendation": "Опишите формат консультаций и обратной связи"
      }
    ],
    "status": "published",
    "published_at": "2026-09-23T11:09:57.360714Z",
    "proposals_count": 0
  }
]
```

### Фильтр по теме и уровню — ничего не найдено

`GET /api/tasks?topic=finance&readiness=priority` → **200**

Ответ:
```json
[]
```

### Подтвердить полную карточку опубликованной задачи (пересчёт)

`PUT /api/tasks/e7d1bd2f-c081-49c2-814e-b7570a1258e6/confirm` → **200**

Запрос:
```json
{
  "card": {
    "title": "Оптимизация обработки заявок",
    "topic": "automation",
    "context": "Заявки приходят в WhatsApp и обрабатываются вручную",
    "need": "Сократить время обработки заявок",
    "users": "Операторы службы поддержки",
    "data": "Выгрузка заявок за 3 месяца в CSV",
    "constraints": "2 недели, Python",
    "expected_result": "Прототип бота для заявок",
    "success_criteria": "Время ответа меньше 5 минут",
    "contact": "@manager",
    "interaction_format": "Созвон раз в неделю"
  }
}
```

Ответ:
```json
{
  "id": "e7d1bd2f-c081-49c2-814e-b7570a1258e6",
  "status": "published",
  "draft_text": "Хотим улучшить обработку заявок клиентов",
  "title": "Оптимизация обработки заявок",
  "topic": "automation",
  "card": {
    "title": "Оптимизация обработки заявок",
    "topic": "automation",
    "context": "Заявки приходят в WhatsApp и обрабатываются вручную",
    "need": "Сократить время обработки заявок",
    "users": "Операторы службы поддержки",
    "data": "Выгрузка заявок за 3 месяца в CSV",
    "constraints": "2 недели, Python",
    "expected_result": "Прототип бота для заявок",
    "success_criteria": "Время ответа меньше 5 минут",
    "contact": "@manager",
    "interaction_format": "Созвон раз в неделю"
  },
  "score": 100,
  "readiness_level": "priority",
  "score_breakdown": [
    {
      "field": "context",
      "label": "Контекст",
      "earned": 10,
      "maximum": 10,
      "reason": "Контекст: указано"
    },
    {
      "field": "need",
      "label": "Потребность",
      "earned": 10,
      "maximum": 10,
      "reason": "Потребность: указано"
    },
    {
      "field": "data",
      "label": "Данные и материалы",
      "earned": 20,
      "maximum": 20,
      "reason": "Данные и материалы: указано"
    },
    {
      "field": "expected_result",
      "label": "Ожидаемый результат",
      "earned": 15,
      "maximum": 15,
      "reason": "Ожидаемый результат: указано"
    },
    {
      "field": "success_criteria",
      "label": "Критерии успеха",
      "earned": 15,
      "maximum": 15,
      "reason": "Критерии успеха: указано"
    },
    {
      "field": "constraints",
      "label": "Ограничения",
      "earned": 10,
      "maximum": 10,
      "reason": "Ограничения: указано"
    },
    {
      "field": "users",
      "label": "Пользователи",
      "earned": 10,
      "maximum": 10,
      "reason": "Пользователи: указано"
    },
    {
      "field": "contact",
      "label": "Контакт",
      "earned": 5,
      "maximum": 5,
      "reason": "Контакт: указано"
    },
    {
      "field": "interaction_format",
      "label": "Формат взаимодействия",
      "earned": 5,
      "maximum": 5,
      "reason": "Формат взаимодействия: указано"
    }
  ],
  "missing_fields": [],
  "confirmed_at": "2026-09-23T11:09:57.696466Z",
  "published_at": "2026-09-23T11:09:57.099188Z",
  "created_at": "2026-09-23T11:09:56.754529Z",
  "updated_at": "2026-09-23T11:09:57.693405Z",
  "proposals_count": 0
}
```

### Каталог после пересчёта: задача поднялась на первое место

`GET /api/tasks` → **200**

Ответ:
```json
[
  {
    "id": "e7d1bd2f-c081-49c2-814e-b7570a1258e6",
    "title": "Оптимизация обработки заявок",
    "topic": "automation",
    "context_preview": "Заявки приходят в WhatsApp и обрабатываются вручную",
    "score": 100,
    "readiness_level": "priority",
    "missing_fields": [],
    "status": "published",
    "published_at": "2026-09-23T11:09:57.099188Z",
    "proposals_count": 0
  },
  {
    "id": "02f20cd0-399b-40ed-b8be-825a2934e3b9",
    "title": "Дашборд продаж",
    "topic": "analytics",
    "context_preview": "Отчёты собираются вручную",
    "score": 70,
    "readiness_level": "ready",
    "missing_fields": [
      {
        "field": "constraints",
        "label": "Ограничения",
        "potential_points": 10,
        "recommendation": "Укажите сроки, технологии, доступы и другие ограничения"
      },
      {
        "field": "users",
        "label": "Пользователи",
        "potential_points": 10,
        "recommendation": "Укажите, для кого создаётся решение"
      },
      {
        "field": "contact",
        "label": "Контакт",
        "potential_points": 5,
        "recommendation": "Добавьте контакт представителя бизнеса"
      },
      {
        "field": "interaction_format",
        "label": "Формат взаимодействия",
        "potential_points": 5,
        "recommendation": "Опишите формат консультаций и обратной связи"
      }
    ],
    "status": "published",
    "published_at": "2026-09-23T11:09:57.360714Z",
    "proposals_count": 0
  }
]
```

## Предложения

### Предложение Team Alpha

`POST /api/tasks/e7d1bd2f-c081-49c2-814e-b7570a1258e6/proposals` → **201**

Запрос:
```json
{
  "team_id": "00000000-0000-4000-8000-000000000001",
  "idea": "Чат-бот в WhatsApp, который регистрирует заявки",
  "plan": "Неделя на прототип, неделя на интеграцию с таблицей",
  "estimated_duration": "2 недели",
  "prototype_url": "https://example.com/demo"
}
```

Ответ:
```json
{
  "id": "ca566206-2341-4de3-b4df-78dff22ea9a0",
  "task_id": "e7d1bd2f-c081-49c2-814e-b7570a1258e6",
  "task_title": "Оптимизация обработки заявок",
  "team_id": "00000000-0000-4000-8000-000000000001",
  "team_name": "Team Alpha",
  "idea": "Чат-бот в WhatsApp, который регистрирует заявки",
  "plan": "Неделя на прототип, неделя на интеграцию с таблицей",
  "estimated_duration": "2 недели",
  "prototype_url": "https://example.com/demo",
  "status": "pending",
  "created_at": "2026-09-23T11:09:57.865515Z",
  "updated_at": "2026-09-23T11:09:57.865515Z"
}
```

### Предложение Team Beta (без прототипа)

`POST /api/tasks/e7d1bd2f-c081-49c2-814e-b7570a1258e6/proposals` → **201**

Запрос:
```json
{
  "team_id": "00000000-0000-4000-8000-000000000002",
  "idea": "Форма заявок на сайте",
  "plan": "Лендинг и выгрузка в CRM",
  "estimated_duration": "3 недели",
  "prototype_url": null
}
```

Ответ:
```json
{
  "id": "06951bcc-ebf5-4caa-af4a-7d8fe9e5ee4b",
  "task_id": "e7d1bd2f-c081-49c2-814e-b7570a1258e6",
  "task_title": "Оптимизация обработки заявок",
  "team_id": "00000000-0000-4000-8000-000000000002",
  "team_name": "Team Beta",
  "idea": "Форма заявок на сайте",
  "plan": "Лендинг и выгрузка в CRM",
  "estimated_duration": "3 недели",
  "prototype_url": null,
  "status": "pending",
  "created_at": "2026-09-23T11:09:57.981343Z",
  "updated_at": "2026-09-23T11:09:57.981343Z"
}
```

### Принять предложение Team Alpha

`PATCH /api/proposals/ca566206-2341-4de3-b4df-78dff22ea9a0` → **200**

Запрос:
```json
{
  "status": "accepted"
}
```

Ответ:
```json
{
  "id": "ca566206-2341-4de3-b4df-78dff22ea9a0",
  "task_id": "e7d1bd2f-c081-49c2-814e-b7570a1258e6",
  "task_title": "Оптимизация обработки заявок",
  "team_id": "00000000-0000-4000-8000-000000000001",
  "team_name": "Team Alpha",
  "idea": "Чат-бот в WhatsApp, который регистрирует заявки",
  "plan": "Неделя на прототип, неделя на интеграцию с таблицей",
  "estimated_duration": "2 недели",
  "prototype_url": "https://example.com/demo",
  "status": "accepted",
  "created_at": "2026-09-23T11:09:57.865515Z",
  "updated_at": "2026-09-23T11:09:58.091764Z"
}
```

### Отклонить предложение Team Beta

`PATCH /api/proposals/06951bcc-ebf5-4caa-af4a-7d8fe9e5ee4b` → **200**

Запрос:
```json
{
  "status": "rejected"
}
```

Ответ:
```json
{
  "id": "06951bcc-ebf5-4caa-af4a-7d8fe9e5ee4b",
  "task_id": "e7d1bd2f-c081-49c2-814e-b7570a1258e6",
  "task_title": "Оптимизация обработки заявок",
  "team_id": "00000000-0000-4000-8000-000000000002",
  "team_name": "Team Beta",
  "idea": "Форма заявок на сайте",
  "plan": "Лендинг и выгрузка в CRM",
  "estimated_duration": "3 недели",
  "prototype_url": null,
  "status": "rejected",
  "created_at": "2026-09-23T11:09:57.981343Z",
  "updated_at": "2026-09-23T11:09:58.179456Z"
}
```

### Предложения по задаче (для бизнеса)

`GET /api/tasks/e7d1bd2f-c081-49c2-814e-b7570a1258e6/proposals` → **200**

Ответ:
```json
[
  {
    "id": "ca566206-2341-4de3-b4df-78dff22ea9a0",
    "task_id": "e7d1bd2f-c081-49c2-814e-b7570a1258e6",
    "task_title": "Оптимизация обработки заявок",
    "team_id": "00000000-0000-4000-8000-000000000001",
    "team_name": "Team Alpha",
    "idea": "Чат-бот в WhatsApp, который регистрирует заявки",
    "plan": "Неделя на прототип, неделя на интеграцию с таблицей",
    "estimated_duration": "2 недели",
    "prototype_url": "https://example.com/demo",
    "status": "accepted",
    "created_at": "2026-09-23T11:09:57.865515Z",
    "updated_at": "2026-09-23T11:09:58.091764Z"
  },
  {
    "id": "06951bcc-ebf5-4caa-af4a-7d8fe9e5ee4b",
    "task_id": "e7d1bd2f-c081-49c2-814e-b7570a1258e6",
    "task_title": "Оптимизация обработки заявок",
    "team_id": "00000000-0000-4000-8000-000000000002",
    "team_name": "Team Beta",
    "idea": "Форма заявок на сайте",
    "plan": "Лендинг и выгрузка в CRM",
    "estimated_duration": "3 недели",
    "prototype_url": null,
    "status": "rejected",
    "created_at": "2026-09-23T11:09:57.981343Z",
    "updated_at": "2026-09-23T11:09:58.179456Z"
  }
]
```

### Предложения команды (Team Alpha видит статус)

`GET /api/proposals?team_id=00000000-0000-4000-8000-000000000001` → **200**

Ответ:
```json
[
  {
    "id": "ca566206-2341-4de3-b4df-78dff22ea9a0",
    "task_id": "e7d1bd2f-c081-49c2-814e-b7570a1258e6",
    "task_title": "Оптимизация обработки заявок",
    "team_id": "00000000-0000-4000-8000-000000000001",
    "team_name": "Team Alpha",
    "idea": "Чат-бот в WhatsApp, который регистрирует заявки",
    "plan": "Неделя на прототип, неделя на интеграцию с таблицей",
    "estimated_duration": "2 недели",
    "prototype_url": "https://example.com/demo",
    "status": "accepted",
    "created_at": "2026-09-23T11:09:57.865515Z",
    "updated_at": "2026-09-23T11:09:58.091764Z"
  }
]
```

## Ошибки

### Задача не найдена

`GET /api/tasks/00000000-0000-0000-0000-000000000000` → **404**

Ответ:
```json
{
  "error": {
    "code": "TASK_NOT_FOUND",
    "message": "Задача не найдена"
  }
}
```

### topic не slug

`POST /api/tasks` → **422**

Запрос:
```json
{
  "draft_text": "Текст",
  "topic": "Автоматизация"
}
```

Ответ:
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Некорректные данные запроса: topic — Input should be 'automation', 'analytics', 'marketing', 'education', 'finance' or 'other'"
  }
}
```

### Пустой запрос к AI

`POST /api/ai/analyze-draft` → **422**

Запрос:
```json
{}
```

Ответ:
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Некорректные данные запроса: draft — Field required"
  }
}
```

### Лишнее поле в карточке

`POST /api/rating/preview` → **422**

Запрос:
```json
{
  "card": {
    "budget": "1000"
  }
}
```

Ответ:
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Некорректные данные запроса: card.budget — Extra inputs are not permitted"
  }
}
```

### Неизвестный фильтр каталога

`GET /api/tasks?readiness=high` → **422**

Ответ:
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Некорректные данные запроса: query.readiness — Input should be 'draft', 'working', 'ready' or 'priority'"
  }
}
```

### Предложение на неопубликованную задачу

`POST /api/tasks/ad9336f0-3626-41a5-9ea3-99791a2aa3be/proposals` → **409**

Запрос:
```json
{
  "team_id": "00000000-0000-4000-8000-000000000001",
  "idea": "Идея",
  "plan": "План",
  "estimated_duration": "1 неделя"
}
```

Ответ:
```json
{
  "error": {
    "code": "TASK_NOT_PUBLISHED",
    "message": "Предложение можно отправить только на опубликованную задачу"
  }
}
```

### Команда не найдена

`POST /api/tasks/e7d1bd2f-c081-49c2-814e-b7570a1258e6/proposals` → **404**

Запрос:
```json
{
  "team_id": "00000000-0000-4000-8000-000000000009",
  "idea": "Идея",
  "plan": "План",
  "estimated_duration": "1 неделя"
}
```

Ответ:
```json
{
  "error": {
    "code": "TEAM_NOT_FOUND",
    "message": "Команда не найдена"
  }
}
```

### Ссылка на прототип не http(s)

`POST /api/tasks/e7d1bd2f-c081-49c2-814e-b7570a1258e6/proposals` → **422**

Запрос:
```json
{
  "team_id": "00000000-0000-4000-8000-000000000001",
  "idea": "Идея",
  "plan": "План",
  "estimated_duration": "1 неделя",
  "prototype_url": "ftp://example.com"
}
```

Ответ:
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Некорректные данные запроса: prototype_url — Value error, Ссылка должна начинаться с http:// или https://"
  }
}
```

### Повторное решение по предложению

`PATCH /api/proposals/06951bcc-ebf5-4caa-af4a-7d8fe9e5ee4b` → **409**

Запрос:
```json
{
  "status": "accepted"
}
```

Ответ:
```json
{
  "error": {
    "code": "PROPOSAL_ALREADY_DECIDED",
    "message": "Решение по предложению уже принято"
  }
}
```

### Недопустимый статус

`PATCH /api/proposals/ca566206-2341-4de3-b4df-78dff22ea9a0` → **422**

Запрос:
```json
{
  "status": "pending"
}
```

Ответ:
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Некорректные данные запроса: status — Input should be 'accepted' or 'rejected'"
  }
}
```

### Предложение не найдено

`PATCH /api/proposals/00000000-0000-0000-0000-000000000000` → **404**

Запрос:
```json
{
  "status": "accepted"
}
```

Ответ:
```json
{
  "error": {
    "code": "PROPOSAL_NOT_FOUND",
    "message": "Предложение не найдено"
  }
}
```

### Список команды без team_id

`GET /api/proposals` → **422**

Ответ:
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Некорректные данные запроса: query.team_id — Field required"
  }
}
```

### AI недоступен (без ключа OpenAI)

`POST /api/ai/build-card` → **503**. Снят на стеке без `OPENAI_API_KEY`:
```json
{
  "error": {
    "code": "AI_UNAVAILABLE",
    "message": "AI недоступен. Повторите позже.",
    "retryable": true
  }
}
```
`POST /api/ai/analyze-draft` в этом случае отвечает 200 с `"source": "fallback"`
и заголовком `X-AI-Fallback: true`.
