from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

if __package__ and "." in __package__:
    from ..database import get_db
    from ..schemas import ImprovementCreate, ImprovementSubmission
    from ..services import ImprovementPersistenceError, submit_improvement
else:
    from database import get_db
    from schemas import ImprovementCreate, ImprovementSubmission
    from services import ImprovementPersistenceError, submit_improvement

router = APIRouter(tags=["Improvements"])


@router.post(
    "/improvements",
    response_model=ImprovementSubmission,
    response_model_by_alias=True,
    status_code=status.HTTP_201_CREATED,
    responses={
        status.HTTP_503_SERVICE_UNAVAILABLE: {
            "description": "The proposal could not be stored."
        }
    },
)
def create_improvement(
    request: ImprovementCreate, session: Session = Depends(get_db)
) -> ImprovementSubmission:
    try:
        improvement = submit_improvement(session, request)
    except ImprovementPersistenceError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Unable to submit proposal at this time.",
        ) from exc
    return ImprovementSubmission.model_validate(improvement)
