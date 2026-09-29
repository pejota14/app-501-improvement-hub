import secrets
from datetime import datetime, timezone

from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session

if __package__:
    from .models import Improvement, ImprovementStatus
    from .repositories import ImprovementRepository
    from .schemas import ImprovementCreate
else:
    from models import Improvement, ImprovementStatus
    from repositories import ImprovementRepository
    from schemas import ImprovementCreate


class ImprovementPersistenceError(Exception):
    """Raised when a proposal cannot be persisted safely."""


def _new_reference_number() -> str:
    date_part = datetime.now(timezone.utc).strftime("%Y%m%d")
    random_part = secrets.token_hex(4).upper()
    return f"IH-{date_part}-{random_part}"


def submit_improvement(
    session: Session, request: ImprovementCreate
) -> Improvement:
    repository = ImprovementRepository(session)

    for attempt in range(3):
        improvement = Improvement(
            reference_number=_new_reference_number(),
            name=request.name,
            email=str(request.email),
            area=request.area,
            title=request.title,
            description=request.description,
            expected_impact=request.expected_impact,
            status=ImprovementStatus.submitted,
        )
        try:
            return repository.save(improvement)
        except IntegrityError as exc:
            repository.rollback()
            if attempt == 2:
                raise ImprovementPersistenceError from exc
        except SQLAlchemyError as exc:
            repository.rollback()
            raise ImprovementPersistenceError from exc

    raise ImprovementPersistenceError
