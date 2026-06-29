import type {
  CreateDeviceInput,
  CreateGraphicInput,
  CreateReportInput,
  CreateProjectInput,
  CreateTagInput,
  DeviceDatabaseStatus,
  DeviceSummary,
  DeviceTreeNode,
  GraphicDatabaseStatus,
  GraphicSummary,
  ReportDatabaseStatus,
  ReportSummary,
  ProjectDatabaseStatus,
  ProjectSummary,
  TagDatabaseStatus,
  TagSummary,
  UpdateDeviceInput,
  UpdateGraphicInput,
  UpdateReportInput,
  UpdateProjectInput,
  UpdateTagInput
} from '@energylink/shared-types';
import type {
  SpreadsheetPreviewRequest,
  SpreadsheetPreviewResult,
  SpreadsheetTemplateImportInput,
  SpreadsheetTemplateImportResult,
} from '../api/reportsSpreadsheetApi';

declare global {
  interface Window {
    energylink: {
      appName: string;
      phase: string;
      projects: {
        list(): Promise<ProjectSummary[]>;
        create(input: CreateProjectInput): Promise<ProjectSummary>;
        update(input: UpdateProjectInput): Promise<ProjectSummary>;
        delete(id: string): Promise<boolean>;
        setActive(id: string): Promise<ProjectSummary>;
        status(): Promise<ProjectDatabaseStatus>;
      };
      devices: {
        list(projectId?: string): Promise<DeviceSummary[]>;
        tree(projectId?: string): Promise<DeviceTreeNode[]>;
        create(input: CreateDeviceInput): Promise<DeviceSummary>;
        update(input: UpdateDeviceInput): Promise<DeviceSummary>;
        delete(id: string): Promise<boolean>;
        status(projectId?: string): Promise<DeviceDatabaseStatus>;
      };
      tags: {
        list(projectId?: string): Promise<TagSummary[]>;
        listByDevice(deviceId: string): Promise<TagSummary[]>;
        create(input: CreateTagInput): Promise<TagSummary>;
        update(input: UpdateTagInput): Promise<TagSummary>;
        delete(id: string): Promise<boolean>;
        status(projectId?: string): Promise<TagDatabaseStatus>;
      };
      graphics: {
        list(projectId?: string): Promise<GraphicSummary[]>;
        get(id: string): Promise<GraphicSummary | null>;
        create(input: CreateGraphicInput): Promise<GraphicSummary>;
        update(input: UpdateGraphicInput): Promise<GraphicSummary>;
        delete(id: string): Promise<boolean>;
        status(projectId?: string): Promise<GraphicDatabaseStatus>;
        listHistory(graphicId: string): Promise<import('@energylink/shared-types').GraphicLayoutSnapshot[]>;
        restoreHistory(graphicId: string, revisionId: string): Promise<GraphicSummary>;
        deleteHistory(graphicId: string, revisionId: string): Promise<import('@energylink/shared-types').GraphicLayoutSnapshot[]>;
      };
      reports: {
        list(projectId?: string): Promise<ReportSummary[]>;
        get(id: string): Promise<ReportSummary | null>;
        create(input: CreateReportInput): Promise<ReportSummary>;
        update(input: UpdateReportInput): Promise<ReportSummary>;
        delete(id: string): Promise<boolean>;
        status(projectId?: string): Promise<ReportDatabaseStatus>;
        importSpreadsheetTemplate(input: SpreadsheetTemplateImportInput & { reportId: string }): Promise<SpreadsheetTemplateImportResult>;
        resolveSpreadsheetPreview(input: SpreadsheetPreviewRequest & { reportId: string }): Promise<SpreadsheetPreviewResult>;
      };
      utils: {
        openFile(filters: { name: string; extensions: string[] }[]): Promise<string | undefined>;
      };
      window: {
        minimize(): void;
        maximize(): void;
        close(): void;
        isMaximized(): Promise<boolean>;
      };
    };
  }
}

export {};
