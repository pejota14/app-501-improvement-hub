from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

if __package__:
    from .models import ImprovementArea, ImprovementImpact, ImprovementStatus
else:
    from models import ImprovementArea, ImprovementImpact, ImprovementStatus


def _to_camel(value: str) -> str:
    first, *rest = value.split("_")
    return first + "".join(part.capitalize() for part in rest)


class ApiModel(BaseModel):
    model_config = ConfigDict(
        alias_generator=_to_camel,
        populate_by_name=True,
        from_attributes=True,
        extra="forbid",
    )


class ImprovementCreate(ApiModel):
    name: str = Field(min_length=1, max_length=150)
    email: EmailStr = Field(max_length=254)
    area: ImprovementArea
    title: str = Field(min_length=1, max_length=100)
    description: str = Field(min_length=1, max_length=10_000)
    expected_impact: ImprovementImpact

    @field_validator("name", "title", "description", mode="before")
    @classmethod
    def strip_required_text(cls, value: object) -> object:
        return value.strip() if isinstance(value, str) else value

    @field_validator("email", mode="before")
    @classmethod
    def normalize_email(cls, value: object) -> object:
        return value.strip().lower() if isinstance(value, str) else value


class ImprovementSubmission(ApiModel):
    id: str
    reference_number: str
    status: ImprovementStatus
    created_at: datetime


class HealthResponse(BaseModel):
    status: str
