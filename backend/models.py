import enum
import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, Enum, String, Text
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


class ImprovementArea(str, enum.Enum):
    engineering = "engineering"
    product = "product"
    operations = "operations"
    other = "other"


class ImprovementImpact(str, enum.Enum):
    low = "low"
    medium = "medium"
    high = "high"


class ImprovementStatus(str, enum.Enum):
    submitted = "Submitted"


class Improvement(Base):
    __tablename__ = "improvements"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    reference_number: Mapped[str] = mapped_column(
        String(24), unique=True, nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    email: Mapped[str] = mapped_column(String(254), nullable=False)
    area: Mapped[ImprovementArea] = mapped_column(
        Enum(ImprovementArea, native_enum=False, length=20), nullable=False
    )
    title: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    expected_impact: Mapped[ImprovementImpact] = mapped_column(
        Enum(ImprovementImpact, native_enum=False, length=10), nullable=False
    )
    status: Mapped[ImprovementStatus] = mapped_column(
        Enum(
            ImprovementStatus,
            values_callable=lambda enum_class: [item.value for item in enum_class],
            native_enum=False,
            length=20,
        ),
        nullable=False,
        default=ImprovementStatus.submitted,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )
