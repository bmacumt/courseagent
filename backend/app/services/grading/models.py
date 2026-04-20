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
            name="objective",
            label="实验目的",
            weight=0.15,
            description="实验目的表述是否明确、具体，是否与研究问题紧密关联",
        ),
        DimensionConfig(
            name="hypothesis",
            label="假设合理性",
            weight=0.15,
            description="提出的假设是否有科学依据，逻辑是否自洽，是否可检验",
        ),
        DimensionConfig(
            name="variables",
            label="变量控制",
            weight=0.20,
            description="自变量、因变量的识别和控制是否合理，是否考虑了干扰变量",
        ),
        DimensionConfig(
            name="methodology",
            label="方法可行性",
            weight=0.20,
            description="实验方法是否科学可行，步骤是否完整，工具和材料选择是否恰当",
        ),
        DimensionConfig(
            name="safety",
            label="安全风险",
            weight=0.15,
            description="是否识别并评估了实验中的安全风险，防护措施是否到位",
        ),
        DimensionConfig(
            name="data_plan",
            label="数据方案",
            weight=0.10,
            description="数据采集方案是否合理，样本量是否充足，分析方法是否适当",
        ),
        DimensionConfig(
            name="conclusion",
            label="结论逻辑",
            weight=0.05,
            description="结论是否基于数据得出，推理是否严密，是否存在过度推断",
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
