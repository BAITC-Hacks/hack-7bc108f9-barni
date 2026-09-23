import pytest

from app.schemas.ai import TaskCard
from app.services.rating_service import WEIGHTS, calculate_score, readiness_level

SCORED = [field for field, *_ in WEIGHTS]


def card(*filled: str, **values: str | None) -> TaskCard:
    data = dict.fromkeys(TaskCard.model_fields)
    data.update({field: "Указано" for field in filled})
    data.update(values)
    return TaskCard.model_validate(data)


@pytest.mark.parametrize(
    ("filled", "score", "level"),
    [
        ((), 0, "draft"),
        (("context", "need", "data"), 40, "working"),
        (("context", "need", "data", "expected_result", "success_criteria"), 70, "ready"),
        (
            ("context", "need", "data", "expected_result", "success_criteria",
             "constraints", "users"),
            90,
            "priority",
        ),
        (tuple(SCORED), 100, "priority"),
    ],
)
def test_score_and_level(filled, score, level):
    result = calculate_score(card(*filled))
    assert result.score == score
    assert result.readiness_level == level


def test_weights_match_tz():
    assert dict((field, points) for field, _, points, _ in WEIGHTS) == {
        "context": 10,
        "need": 10,
        "data": 20,
        "expected_result": 15,
        "success_criteria": 15,
        "constraints": 10,
        "users": 10,
        "contact": 5,
        "interaction_format": 5,
    }


@pytest.mark.parametrize(
    ("score", "level"),
    [(0, "draft"), (39, "draft"), (40, "working"), (69, "working"),
     (70, "ready"), (89, "ready"), (90, "priority"), (100, "priority")],
)
def test_readiness_boundaries(score, level):
    assert readiness_level(score) == level


@pytest.mark.parametrize("filled", [(), ("data",), ("contact", "users"), tuple(SCORED)])
def test_breakdown_sums_to_score_and_covers_every_scored_field(filled):
    result = calculate_score(card(*filled))
    assert sum(item.earned for item in result.breakdown) == result.score
    assert [item.field for item in result.breakdown] == SCORED
    assert sum(item.maximum for item in result.breakdown) == 100


def test_missing_fields_list_what_is_left_with_potential_points():
    result = calculate_score(card("context", "need", "data", "expected_result",
                                  "constraints", "users"))
    assert result.score == 75
    assert result.readiness_level == "ready"
    missing = {item.field: item.potential_points for item in result.missing_fields}
    assert missing == {"success_criteria": 15, "contact": 5, "interaction_format": 5}
    assert all(item.recommendation for item in result.missing_fields)
    assert result.score + sum(missing.values()) == 100


def test_long_text_earns_no_extra_points():
    short = calculate_score(card(context="Да"))
    long = calculate_score(card(context="очень подробно " * 500))
    assert short.score == long.score == 10


def test_punctuation_only_value_is_not_filled():
    result = calculate_score(card(context="-", need="...", data="—"))
    assert result.score == 0
    assert {item.field for item in result.missing_fields} >= {"context", "need", "data"}


def test_title_and_topic_are_not_scored():
    assert calculate_score(card(title="Задача", topic="automation")).score == 0
