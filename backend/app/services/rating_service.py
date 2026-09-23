import re

from app.schemas.ai import TaskCard
from app.schemas.task import BreakdownItem, MissingField, ScoreResult

# field, label, points, recommendation — tz.md §6.2; title and topic are not scored.
WEIGHTS = [
    ("context", "Контекст", 10, "Опишите, как процесс устроен сейчас"),
    ("need", "Потребность", 10, "Сформулируйте, что именно нужно изменить"),
    ("data", "Данные и материалы", 20, "Укажите, какие данные и материалы получит команда"),
    ("expected_result", "Ожидаемый результат", 15, "Опишите результат, который должна подготовить команда"),
    ("success_criteria", "Критерии успеха", 15, "Добавьте измеримые признаки успешного результата"),
    ("constraints", "Ограничения", 10, "Укажите сроки, технологии, доступы и другие ограничения"),
    ("users", "Пользователи", 10, "Укажите, для кого создаётся решение"),
    ("contact", "Контакт", 5, "Добавьте контакт представителя бизнеса"),
    ("interaction_format", "Формат взаимодействия", 5, "Опишите формат консультаций и обратной связи"),
]
assert sum(points for _, _, points, _ in WEIGHTS) == 100

LEVELS = [(90, "priority"), (70, "ready"), (40, "working"), (0, "draft")]


def readiness_level(score: int) -> str:
    return next(level for minimum, level in LEVELS if score >= minimum)


WORD = re.compile(r"[^\W_]+")
MIN_WORDS = 3
MIN_CONTACT_LENGTH = 5


def is_filled(field: str, value: str | None) -> bool:
    # Binary: meeting the minimum earns full weight, longer text earns nothing more.
    if value is None:
        return False
    value = value.strip()
    if field == "contact":
        return len(value) >= MIN_CONTACT_LENGTH and WORD.search(value) is not None
    return len(WORD.findall(value)) >= MIN_WORDS


def calculate_score(card: TaskCard) -> ScoreResult:
    breakdown: list[BreakdownItem] = []
    missing: list[MissingField] = []
    for field, label, points, recommendation in WEIGHTS:
        filled = is_filled(field, getattr(card, field))
        breakdown.append(
            BreakdownItem(
                field=field,
                label=label,
                earned=points if filled else 0,
                maximum=points,
                reason=f"{label}: указано" if filled else f"{label}: не указано",
            )
        )
        if not filled:
            missing.append(
                MissingField(
                    field=field,
                    label=label,
                    potential_points=points,
                    recommendation=recommendation,
                )
            )
    score = sum(item.earned for item in breakdown)
    return ScoreResult(
        score=score,
        readiness_level=readiness_level(score),
        breakdown=breakdown,
        missing_fields=missing,
    )
