"""Pydantic models for the grading pipeline."""
from pydantic import BaseModel, Field


class DimensionConfig(BaseModel):
    name: str  # e.g. "accuracy"
    label: str  # e.g. "准确性"
    weight: float = Field(ge=0, le=1)  # e.g. 0.3
    description: str  # scoring criteria for this dimension


class GradingCriteria(BaseModel):
    dimensions: list[DimensionConfig]
    reference_answer: str | None = None
    max_score: int = 100
    extra_instructions: str | None = None


DEFAULT_CRITERIA = GradingCriteria(
    dimensions=[
        DimensionConfig(
            name="accuracy",
            label="准确性",
            weight=0.30,
            description="内容是否正确，技术要点是否准确无误",
        ),
        DimensionConfig(
            name="completeness",
            label="完整性",
            weight=0.25,
            description="是否覆盖了题目要求的所有要点，有无遗漏",
        ),
        DimensionConfig(
            name="compliance",
            label="规范性",
            weight=0.25,
            description="是否引用了相关的规范标准或技术规程",
        ),
        DimensionConfig(
            name="innovation",
            label="创新性",
            weight=0.20,
            description="是否有自己的思考、独特见解或创新观点",
        ),
    ]
)


class DimensionResult(BaseModel):
    name: str
    label: str
    score: int = Field(ge=0, le=100)
    weight: float
    weighted_score: float
    comment: str


class GradingReport(BaseModel):
    total_score: float
    max_score: int = 100
    dimensions: list[DimensionResult]
    feedback: str
    references: list[str] = []
    regulations_found: list[str] = []
    regulations_cited: list[str] = []
