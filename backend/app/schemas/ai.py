from typing import Annotated, Literal, Self

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, model_validator

Text = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1)]
CardField = Literal[
    "title",
    "topic",
    "context",
    "need",
    "users",
    "data",
    "constraints",
    "expected_result",
    "success_criteria",
    "contact",
    "interaction_format",
]


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class TaskCard(StrictModel):
    # Required but nullable: the structured output must explicitly cover every field.
    title: Text | None
    topic: Text | None
    context: Text | None
    need: Text | None
    users: Text | None
    data: Text | None
    constraints: Text | None
    expected_result: Text | None
    success_criteria: Text | None
    contact: Text | None
    interaction_format: Text | None


class Question(StrictModel):
    id: Text
    target_field: CardField
    text: Text


class AnalyzeDraftRequest(StrictModel):
    draft: Annotated[Text, Field(max_length=20000)]
    topic: Annotated[Text, Field(max_length=500)] | None = None


class AnalyzeDraftResponse(StrictModel):
    known_fields: dict[CardField, Text]
    missing_fields: list[CardField]
    questions: list[Question] = Field(min_length=3, max_length=5)

    @model_validator(mode="after")
    def consistent_fields(self) -> Self:
        missing = set(self.missing_fields)
        if len(missing) != len(self.missing_fields):
            raise ValueError("Duplicate missing fields")
        if missing & self.known_fields.keys():
            raise ValueError("Known and missing fields overlap")
        if missing | self.known_fields.keys() != TaskCard.model_fields.keys():
            raise ValueError("Every card field must be known or missing")
        for attribute in ("id", "target_field", "text"):
            values = [getattr(q, attribute).casefold() for q in self.questions]
            if len(values) != len(set(values)):
                raise ValueError(f"Duplicate question {attribute}")
        if any(q.target_field not in missing for q in self.questions):
            raise ValueError("Questions must target missing fields")
        return self


class Answer(StrictModel):
    question_id: Text
    answer: Annotated[Text, Field(max_length=10000)]


class BuildCardRequest(AnalyzeDraftRequest):
    questions: list[Question] = Field(max_length=11)
    answers: list[Answer] = Field(max_length=11)

    @model_validator(mode="after")
    def matched_answers(self) -> Self:
        ids = [q.id for q in self.questions]
        answers = [a.question_id for a in self.answers]
        if len(ids) != len(set(ids)) or len(answers) != len(set(answers)):
            raise ValueError("Question and answer IDs must be unique")
        if not set(answers) <= set(ids):
            raise ValueError("Answer refers to an unknown question")
        return self


class BuildCardResponse(StrictModel):
    card: TaskCard


class ModelAnalysis(StrictModel):
    # A fixed object avoids dynamic dictionaries in OpenAI's strict JSON schema.
    card: TaskCard
    questions: list[Question] = Field(max_length=5)
