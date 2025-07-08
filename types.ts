
export interface Attachment {
  id: string;
  name: string;
  type: string;
  dataUrl: string; // Base64 encoded URL for image preview
}

export enum SubStepStatus {
  NOT_STARTED = 'Not Started',
  IN_PROGRESS = 'In Progress',
  COMPLETED = 'Completed',
}

// This interface defines the structure for an action item's implementation report.
export interface ActionItemReport {
  notes: string;
  attachments: Attachment[];
  matrixData: { headers: string[]; rows:string[][] } | null;
}

export interface ActionItem {
  id:string;
  text: string;
  completed: boolean;
  dueDate?: string; // Due date for the specific action item
  completedDate?: string; // Date when the action item was marked as completed
  responsible?: string; // Responsible person for the specific action item
  report?: ActionItemReport; // Each action item can have its own detailed implementation report
}

export interface SubStep {
  id:string;
  text: string;
  notes?: string;
  nextSubStepIds?: string[];
  position?: { x: number; y: number };
  
  // New detailed fields for sub-steps
  responsible?: string;
  dueDate?: string;
  status?: SubStepStatus;
  actionItems?: ActionItem[]; // Checklist for the sub-step
  attachments?: Attachment[]; // For sub-step specific files
}


export enum NumericalTargetStatus {
  PENDING = 'pending',
  ACHIEVED = 'achieved',
  MISSED = 'missed',
}

export interface NumericalTarget {
  description: string;
  targetValue: number | string; 
  unit: string;
  currentValue?: number | string;
  testNotes?: string;
  status?: NumericalTargetStatus; 
}

export enum TaskStatus {
  NOT_STARTED = 'Not Started',
  IN_PROGRESS = 'In Progress',
  COMPLETED = 'Completed',
  BLOCKED = 'Blocked',
}

// --- NEW SLIDE DECK REPORTING MODEL ---

export type SlideElementType = 'textbox' | 'image' | 'table' | 'chart' | 'flowchart';
export type SlideLayoutType = 'title_slide' | 'title_and_content' | 'section_header' | 'two_column' | 'blank';
export type ChartType = 'bar' | 'pie' | 'line';

export interface SlideElementPosition {
  x: number; // percentage
  y: number; // percentage
  width: number; // percentage
  height: number; // percentage
}

export interface BaseSlideElement {
  id: string;
  type: SlideElementType;
  position: SlideElementPosition;
}

export interface TextboxElement extends BaseSlideElement {
  type: 'textbox';
  content: string;
  fontSize?: 'small' | 'medium' | 'large' | 'title';
  fontWeight?: 'normal' | 'bold';
  textAlign?: 'left' | 'center' | 'right';
}

export interface ImageElement extends BaseSlideElement {
  type: 'image';
  // Points to an attachment within an action item's report
  subStepId: string;
  actionItemId: string; 
  attachmentId: string;
}

export interface TableElement extends BaseSlideElement {
  type: 'table';
  // Points to matrixData within an action item's report
  subStepId: string;
  actionItemId: string;
}

export interface ChartElement extends BaseSlideElement {
  type: 'chart';
  // Points to matrixData within an action item's report
  subStepId: string;
  actionItemId: string;
  chartType: ChartType;
  title: string;
}

export interface FlowchartElement extends BaseSlideElement {
  type: 'flowchart';
  data: {
    subSteps: SubStep[];
  };
}

export type SlideElement = TextboxElement | ImageElement | TableElement | ChartElement | FlowchartElement;

export interface Slide {
  id: string;
  layout: SlideLayoutType;
  elements: SlideElement[];
  notes?: string; // Speaker notes
  isLocked?: boolean;
}

export interface SlideDeck {
  slides: Slide[];
  theme?: 'light' | 'dark' | 'business';
}


// --- Main Project Interfaces ---

export interface Decision {
  id: string;
  question: string; // What needed to be decided
  decision?: string; // The final outcome, undefined if not decided
  reasoning?: string; // Justification for the decision, or importance if undecided
  date?: string; // YYYY-MM-DD, undefined if not decided
  status: 'decided' | 'undecided';
}

export interface ExtendedTaskDetails {
  subSteps: SubStep[];
  resources: string;
  responsible: string;
  notes: string; 
  numericalTarget?: NumericalTarget;
  dueDate?: string; 
  reportDeck?: SlideDeck; // Replaces ReportData
  resourceMatrix?: { headers: string[]; rows: string[][] } | null;
  attachments?: Attachment[]; // For task-level files
  decisions?: Decision[];
  subStepCanvasSize?: { width: number; height: number };
}

export interface ProjectTask {
  id: string;
  title: string;
  description: string;
  nextTaskIds?: string[];
  position?: { x: number; y: number }; 
  extendedDetails?: ExtendedTaskDetails;
  status?: TaskStatus; 
}

export interface TaskDetail { 
  keyActivities: string[];
  estimatedEffort: string;
  potentialChallenges: string[];
  successMetrics: string[];
}

export enum ViewState {
  INPUT_FORM,
  PROJECT_FLOW,
  TASK_DETAIL,
}

export interface ProjectFileContent {
  projectGoal: string;
  targetDate: string;
  tasks: ProjectTask[];
  ganttData?: GanttItem[] | null;
}

export interface TaskExportData { 
  task: ProjectTask; 
  details: TaskDetail | null; 
}

export type EditableTaskFields = Pick<ProjectTask, 'title' | 'description'>;
export type EditableExtendedTaskDetails = ExtendedTaskDetails;
export type EditableProjectTaskFields = Pick<ProjectTask, 'title' | 'description' | 'status'>;

export enum ReportTheme {
  LIGHT = 'light',
  DARK = 'dark',
  BUSINESS = 'business',
}

export interface ProjectHealthReport {
  overallStatus: 'On Track' | 'At Risk' | 'Off Track' | 'Unknown';
  summary: string;
  positivePoints: string[];
  areasOfConcern: {
      description: string;
      relatedTaskIds: string[];
  }[];
  suggestions: string[];
}

export interface GanttItem {
  id: string;
  name: string;
  start: string; // YYYY-MM-DD
  end: string;   // YYYY-MM-DD
  progress: number; // 0-100
  dependencies: string[];
  type: 'task' | 'substep' | 'actionitem';
  parentId: string | null; // ID of the parent task or sub-step
}