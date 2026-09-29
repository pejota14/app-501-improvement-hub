from sqlalchemy.orm import Session

if __package__:
    from .models import Improvement
else:
    from models import Improvement


class ImprovementRepository:
    def __init__(self, session: Session) -> None:
        self._session = session

    def save(self, improvement: Improvement) -> Improvement:
        self._session.add(improvement)
        self._session.commit()
        return improvement

    def rollback(self) -> None:
        self._session.rollback()
