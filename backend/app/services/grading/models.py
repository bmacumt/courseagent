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
            name="knowledge_integration",
            label="知识整合",
            weight=0.20,
            description="对领域知识的理解深度、文献梳理、逻辑框架、概念体系化程度",
        ),
        DimensionConfig(
            name="comprehensive_literacy",
            label="综合素养",
            weight=0.20,
            description="结构完整性、语言表达、引用规范、逻辑严谨性、学术态度",
        ),
        DimensionConfig(
            name="innovative_thinking",
            label="创新思维",
            weight=0.20,
            description="观点新颖性、研究视角、方法改进、提出新问题/新结论的能力",
        ),
        DimensionConfig(
            name="application_extension",
            label="应用拓展",
            weight=0.20,
            description="理论联系实际、问题解决能力、实践价值、落地可行性、场景迁移",
        ),
        DimensionConfig(
            name="analytical_reasoning",
            label="分析论证",
            weight=0.20,
            description="数据分析、推理严密性、论据充分度、批判性思考、结论可靠性",
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


class ManipulationWarning(BaseModel):
    detected: bool = False
    severity: str = "none"  # none, low, medium, high
    fragments: list[str] = []
    comment: str = ""


class GradingReport(BaseModel):
    total_score: float
    max_score: int = 100
    dimensions: list[DimensionResult]
    feedback: str
    references: list[str] = []
    regulations_found: list[str] = []
    regulations_cited: list[str] = []
    manipulation_warning: ManipulationWarning | None = None
