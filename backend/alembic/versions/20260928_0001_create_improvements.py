"""Create improvements table.

Revision ID: 20260928_0001
Revises:
Create Date: 2026-09-28
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260928_0001"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "improvements",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("reference_number", sa.String(length=24), nullable=False),
        sa.Column("name", sa.String(length=150), nullable=False),
        sa.Column("email", sa.String(length=254), nullable=False),
        sa.Column(
            "area",
            sa.Enum(
                "engineering",
                "product",
                "operations",
                "other",
                name="improvementarea",
                native_enum=False,
                length=20,
            ),
            nullable=False,
        ),
        sa.Column("title", sa.String(length=100), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column(
            "expected_impact",
            sa.Enum(
                "low",
                "medium",
                "high",
                name="improvementimpact",
                native_enum=False,
                length=10,
            ),
            nullable=False,
        ),
        sa.Column(
            "status",
            sa.Enum(
                "Submitted",
                name="improvementstatus",
                native_enum=False,
                length=20,
            ),
            nullable=False,
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_improvements_reference_number"),
        "improvements",
        ["reference_number"],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_improvements_reference_number"), table_name="improvements")
    op.drop_table("improvements")
