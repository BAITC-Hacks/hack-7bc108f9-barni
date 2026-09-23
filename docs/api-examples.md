# Примеры API (реальные ответы)

Сняты с работающего стека (`docker compose up -d --build`, ключ OpenAI задан)
на коде пуша 1, 2026-09-23.
Контракт — `docs/api-contract.md`. UUID и даты у вас будут другими;
формулировки AI-вопросов меняются от запуска к запуску.

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
  "id": "2c8961b1-cd18-4c85-a172-3f78fc2f5899",
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
  "created_at": "2026-09-23T10:37:56.329867Z",
  "updated_at": "2026-09-23T10:37:56.329867Z",
  "proposals_count": 0
}
```

### Получить задачу

`GET /api/tasks/2c8961b1-cd18-4c85-a172-3f78fc2f5899` → **200**

Ответ:
```json
{
  "id": "2c8961b1-cd18-4c85-a172-3f78fc2f5899",
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
  "created_at": "2026-09-23T10:37:56.329867Z",
  "updated_at": "2026-09-23T10:37:56.329867Z",
  "proposals_count": 0
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

`PUT /api/tasks/2c8961b1-cd18-4c85-a172-3f78fc2f5899/confirm` → **200**

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
  "id": "2c8961b1-cd18-4c85-a172-3f78fc2f5899",
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
  "confirmed_at": "2026-09-23T10:37:56.634504Z",
  "published_at": null,
  "created_at": "2026-09-23T10:37:56.329867Z",
  "updated_at": "2026-09-23T10:37:56.631762Z",
  "proposals_count": 0
}
```

### Подтвердить полную карточку (пересчёт)

`PUT /api/tasks/2c8961b1-cd18-4c85-a172-3f78fc2f5899/confirm` → **200**

Запрос:
```json
{
  "card": {
    "title": "Оптимизация обработки заявок",
    "topic": "automation",
    "context": "Заявки приходят в WhatsApp и обрабатываются вручную",
    "need": "Сократить время обработки заявок",
    "users": "Операторы поддержки",
    "data": "Выгрузка заявок за 3 месяца в CSV",
    "constraints": "2 недели, Python",
    "expected_result": "Прототип бота",
    "success_criteria": "Время ответа меньше 5 минут",
    "contact": "@manager",
    "interaction_format": "Созвон раз в неделю"
  }
}
```

Ответ:
```json
{
  "id": "2c8961b1-cd18-4c85-a172-3f78fc2f5899",
  "status": "draft",
  "draft_text": "Хотим улучшить обработку заявок клиентов",
  "title": "Оптимизация обработки заявок",
  "topic": "automation",
  "card": {
    "title": "Оптимизация обработки заявок",
    "topic": "automation",
    "context": "Заявки приходят в WhatsApp и обрабатываются вручную",
    "need": "Сократить время обработки заявок",
    "users": "Операторы поддержки",
    "data": "Выгрузка заявок за 3 месяца в CSV",
    "constraints": "2 недели, Python",
    "expected_result": "Прототип бота",
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
  "confirmed_at": "2026-09-23T10:37:56.915050Z",
  "published_at": null,
  "created_at": "2026-09-23T10:37:56.329867Z",
  "updated_at": "2026-09-23T10:37:56.912245Z",
  "proposals_count": 0
}
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
      "text": "Опишите, пожалуйста, существующий процесс обработки заявок клиентов."
    },
    {
      "id": "q2",
      "target_field": "users",
      "text": "Кто будет основными пользователями решения по улучшению обработки заявок клиентов?"
    },
    {
      "id": "q3",
      "target_field": "data",
      "text": "Какие данные или материалы доступны для анализа и работы над улучшением обработки заявок?"
    },
    {
      "id": "q4",
      "target_field": "expected_result",
      "text": "Каков желаемый конечный результат или продукт улучшения обработки заявок клиентов?"
    },
    {
      "id": "q5",
      "target_field": "success_criteria",
      "text": "Какие критерии будут использоваться для оценки успешности внедрения улучшенной обработки заявок?"
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
      "text": "Опишите, пожалуйста, существующий процесс обработки заявок клиентов."
    },
    {
      "id": "q2",
      "target_field": "users",
      "text": "Кто будет основными пользователями решения по улучшению обработки заявок клиентов?"
    },
    {
      "id": "q3",
      "target_field": "data",
      "text": "Какие данные или материалы доступны для анализа и работы над улучшением обработки заявок?"
    },
    {
      "id": "q4",
      "target_field": "expected_result",
      "text": "Каков желаемый конечный результат или продукт улучшения обработки заявок клиентов?"
    },
    {
      "id": "q5",
      "target_field": "success_criteria",
      "text": "Какие критерии будут использоваться для оценки успешности внедрения улучшенной обработки заявок?"
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

### Ошибка валидации: topic не slug

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

### Ошибка валидации: пустой запрос к AI

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

### Ошибка валидации: лишнее поле в карточке

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

### AI недоступен (без ключа OpenAI)

`POST /api/ai/build-card` → **503**. Снят ранее на стеке без `OPENAI_API_KEY`:
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
