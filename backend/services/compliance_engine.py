import math
from typing import List, Protocol
from models import ComplianceCheck, ComplianceStatus

class ComplianceRule(Protocol):
    rule_code: str
    description: str

    def evaluate(self, project, plot_data: dict) -> ComplianceCheck:
        pass


class DataCompletenessRule:
    rule_code = "DATA_COMPLETENESS"
    description = "Checks if essential plot data fields (area, width, length) are present."

    def evaluate(self, project, plot_data: dict) -> ComplianceCheck:
        if not plot_data:
            return ComplianceCheck(
                project_id=project.id,
                rule_code=self.rule_code,
                description=self.description,
                status=ComplianceStatus.IN_REVIEW,
                detail="Plot data is missing entirely."
            )
        
        missing = []
        for field in ["area", "width", "length"]:
            if plot_data.get(field) is None:
                missing.append(field)
                
        if missing:
            return ComplianceCheck(
                project_id=project.id,
                rule_code=self.rule_code,
                description=self.description,
                status=ComplianceStatus.IN_REVIEW,
                detail=f"Missing essential fields: {', '.join(missing)}."
            )
            
        return ComplianceCheck(
            project_id=project.id,
            rule_code=self.rule_code,
            description=self.description,
            status=ComplianceStatus.PASSING,
            detail="All essential plot data fields are present."
        )


class PlotDimensionsRule:
    rule_code = "PLOT_DIMENSIONS"
    description = "Validates plot width and length are positive numbers."

    def evaluate(self, project, plot_data: dict) -> ComplianceCheck:
        if not plot_data:
            return ComplianceCheck(
                project_id=project.id,
                rule_code=self.rule_code,
                description=self.description,
                status=ComplianceStatus.IN_REVIEW,
                detail="Plot data missing."
            )
            
        width = plot_data.get("width")
        length = plot_data.get("length")
        
        if width is None or length is None:
            return ComplianceCheck(
                project_id=project.id,
                rule_code=self.rule_code,
                description=self.description,
                status=ComplianceStatus.IN_REVIEW,
                detail="Width and/or length missing."
            )
            
        try:
            w = float(width)
            l = float(length)
            if w <= 0 or l <= 0:
                return ComplianceCheck(
                    project_id=project.id,
                    rule_code=self.rule_code,
                    description=self.description,
                    status=ComplianceStatus.FAILING,
                    detail="Width and length must be positive numbers."
                )
            return ComplianceCheck(
                project_id=project.id,
                rule_code=self.rule_code,
                description=self.description,
                status=ComplianceStatus.PASSING,
                detail="Plot dimensions are valid positive numbers."
            )
        except (ValueError, TypeError):
            return ComplianceCheck(
                project_id=project.id,
                rule_code=self.rule_code,
                description=self.description,
                status=ComplianceStatus.FAILING,
                detail="Width and length must be numeric."
            )


class PlotAreaConsistencyRule:
    rule_code = "PLOT_AREA_CONSISTENCY"
    description = "Checks if area is reasonably close to width * length."

    def evaluate(self, project, plot_data: dict) -> ComplianceCheck:
        if not plot_data:
            return ComplianceCheck(
                project_id=project.id,
                rule_code=self.rule_code,
                description=self.description,
                status=ComplianceStatus.IN_REVIEW,
                detail="Plot data missing."
            )
            
        area = plot_data.get("area")
        width = plot_data.get("width")
        length = plot_data.get("length")
        
        if area is None or width is None or length is None:
            return ComplianceCheck(
                project_id=project.id,
                rule_code=self.rule_code,
                description=self.description,
                status=ComplianceStatus.IN_REVIEW,
                detail="Insufficient data to check area consistency."
            )
            
        try:
            a = float(area)
            w = float(width)
            l = float(length)
            
            calc_area = w * l
            if calc_area <= 0:
                return ComplianceCheck(
                    project_id=project.id,
                    rule_code=self.rule_code,
                    description=self.description,
                    status=ComplianceStatus.IN_REVIEW,
                    detail="Width and length must be positive."
                )
                
            diff_pct = abs(a - calc_area) / calc_area
            if diff_pct <= 0.15:
                return ComplianceCheck(
                    project_id=project.id,
                    rule_code=self.rule_code,
                    description=self.description,
                    status=ComplianceStatus.PASSING,
                    detail="Area is consistent with dimensions."
                )
            else:
                return ComplianceCheck(
                    project_id=project.id,
                    rule_code=self.rule_code,
                    description=self.description,
                    status=ComplianceStatus.FAILING,
                    detail=f"Area ({a}) is inconsistent with width * length ({calc_area})."
                )
        except (ValueError, TypeError):
            return ComplianceCheck(
                project_id=project.id,
                rule_code=self.rule_code,
                description=self.description,
                status=ComplianceStatus.FAILING,
                detail="Area, width, and length must be numeric."
            )


class SetbackDataRule:
    rule_code = "SETBACK_DATA"
    description = "Checks if setback distances are provided."

    def evaluate(self, project, plot_data: dict) -> ComplianceCheck:
        if not plot_data:
            return ComplianceCheck(
                project_id=project.id,
                rule_code=self.rule_code,
                description=self.description,
                status=ComplianceStatus.IN_REVIEW,
                detail="Plot data missing."
            )
        
        # Support both flat keys (front, rear, side1, side2) and nested (setbacks.front, etc.)
        setbacks = plot_data.get("setbacks", {})
        if not isinstance(setbacks, dict):
            setbacks = {}
            
        missing = []
        for field in ["front", "rear", "side1", "side2"]:
            # Check nested first, then flat
            val = setbacks.get(field, plot_data.get(field))
            if val is None:
                missing.append(field)
            else:
                try:
                    if float(val) < 0:
                        missing.append(field)
                except (ValueError, TypeError):
                    missing.append(field)
                    
        if missing:
            return ComplianceCheck(
                project_id=project.id,
                rule_code=self.rule_code,
                description=self.description,
                status=ComplianceStatus.IN_REVIEW,
                detail=f"Missing or invalid setback data for: {', '.join(missing)}."
            )
            
        return ComplianceCheck(
            project_id=project.id,
            rule_code=self.rule_code,
            description=self.description,
            status=ComplianceStatus.PASSING,
            detail="All setback distances are provided and positive."
        )


class FarDataRule:
    rule_code = "FAR_DATA"
    description = "Checks if Floor Area Ratio data is provided."

    def evaluate(self, project, plot_data: dict) -> ComplianceCheck:
        return _evaluate_regulatory_limit(
            project, plot_data, 
            self.rule_code, self.description, 
            "max_far", "proposed_far"
        )


class HeightDataRule:
    rule_code = "HEIGHT_DATA"
    description = "Checks if building height data is provided."

    def evaluate(self, project, plot_data: dict) -> ComplianceCheck:
        return _evaluate_regulatory_limit(
            project, plot_data, 
            self.rule_code, self.description, 
            "max_height_m", "proposed_height_m"
        )


class GroundCoverageRule:
    rule_code = "GROUND_COVERAGE"
    description = "Checks if ground coverage data is provided."

    def evaluate(self, project, plot_data: dict) -> ComplianceCheck:
        return _evaluate_regulatory_limit(
            project, plot_data, 
            self.rule_code, self.description, 
            "max_coverage_pct", "proposed_coverage_pct"
        )


def _evaluate_regulatory_limit(
    project, plot_data: dict, rule_code: str, description: str,
    max_field: str, proposed_field: str
) -> ComplianceCheck:
    if not plot_data:
        return ComplianceCheck(
            project_id=project.id,
            rule_code=rule_code,
            description=description,
            status=ComplianceStatus.IN_REVIEW,
            detail=f"{max_field} and {proposed_field} data missing."
        )
        
    max_val = plot_data.get(max_field)
    proposed_val = plot_data.get(proposed_field)
    
    if max_val is None or proposed_val is None:
        return ComplianceCheck(
            project_id=project.id,
            rule_code=rule_code,
            description=description,
            status=ComplianceStatus.IN_REVIEW,
            detail=f"Missing data for {max_field} and/or {proposed_field}."
        )
        
    try:
        m = float(max_val)
        p = float(proposed_val)
        
        if p > m:
            return ComplianceCheck(
                project_id=project.id,
                rule_code=rule_code,
                description=description,
                status=ComplianceStatus.FAILING,
                detail="Proposed value exceeds the user-provided limit. Note: the limit value has not been verified against official regulations."
            )
        else:
            return ComplianceCheck(
                project_id=project.id,
                rule_code=rule_code,
                description=description,
                status=ComplianceStatus.IN_REVIEW,
                detail="User-provided limits have not been verified against official regulations. Requires manual verification by a licensed professional."
            )
    except (ValueError, TypeError):
        return ComplianceCheck(
            project_id=project.id,
            rule_code=rule_code,
            description=description,
            status=ComplianceStatus.IN_REVIEW,
            detail=f"Invalid numeric values for {max_field} and/or {proposed_field}."
        )


def get_all_rules() -> List[ComplianceRule]:
    return [
        DataCompletenessRule(),
        PlotDimensionsRule(),
        PlotAreaConsistencyRule(),
        SetbackDataRule(),
        FarDataRule(),
        HeightDataRule(),
        GroundCoverageRule(),
    ]


def run_compliance_checks(project, db) -> List[ComplianceCheck]:
    db.query(ComplianceCheck).filter(
        ComplianceCheck.project_id == project.id
    ).delete()
    
    plot_data = project.plot_data or {}
    checks = []
    
    for rule in get_all_rules():
        check = rule.evaluate(project, plot_data)
        checks.append(check)
        
    db.add_all(checks)
    db.commit()
    
    for check in checks:
        db.refresh(check)
        
    return checks
