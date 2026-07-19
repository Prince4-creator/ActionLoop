'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Paperclip, Download, Trash2, Upload, FileText, FileImage, FileArchive, File as FileIcon } from 'lucide-react';
import {
  uploadMeetingAttachment,
  getMeetingAttachments,
  getAttachmentDownloadUrl,
  deleteMeetingAttachment,
} from '@/app/actions/attachments';

type Attachment = {
  id: string;
  file_name: string;
  file_path: string;
  file_size: number;
  content_type: string | null;
  uploaded_by: string;
  created_at: string;
};

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function iconFor(contentType: string | null) {
  if (!contentType) return FileIcon;
  if (contentType.startsWith('image/')) return FileImage;
  if (contentType.includes('zip') || contentType.includes('compressed')) return FileArchive;
  if (contentType.includes('pdf') || contentType.startsWith('text/')) return FileText;
  return FileIcon;
}

export function MeetingAttachments({ meetingId, currentUserId }: { meetingId: string; currentUserId: string }) {
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadAttachments = async () => {
    setIsLoading(true);
    try {
      const data = await getMeetingAttachments(meetingId);
      setAttachments(data as Attachment[]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to load attachments');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAttachments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meetingId]);

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 25 * 1024 * 1024) {
      toast.error('File is too large (max 25MB)');
      e.target.value = '';
      return;
    }

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('meeting_id', meetingId);
      formData.append('file', file);
      const result = await uploadMeetingAttachment(formData);
      if (result?.attachment) {
        setAttachments((current) => [result.attachment as Attachment, ...current]);
      }
      toast.success('File uploaded');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Upload failed');
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  const handleDownload = async (attachmentId: string) => {
    try {
      const { url, fileName } = await getAttachmentDownloadUrl(attachmentId);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.click();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to download file');
    }
  };

  const handleDelete = async (attachmentId: string) => {
    if (!confirm('Delete this attachment? This cannot be undone.')) return;
    setDeletingId(attachmentId);
    try {
      await deleteMeetingAttachment(attachmentId);
      setAttachments((current) => current.filter((a) => a.id !== attachmentId));
      toast.success('Attachment deleted');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to delete attachment');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="flex items-center gap-2 text-xl font-semibold text-slate-900 dark:text-slate-100">
            <Paperclip className="h-5 w-5" /> Attachments
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">Slides, screenshots, docs — up to 25MB each.</p>
        </div>
        <div>
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={handleFileSelected}
            disabled={isUploading}
          />
          <Button
            variant="outline"
            size="sm"
            className="rounded-2xl"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
          >
            {isUploading ? (
              'Uploading...'
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" /> Upload file
              </>
            )}
          </Button>
        </div>
      </div>

      {isLoading ? (
        <p className="text-sm text-slate-500">Loading attachments...</p>
      ) : attachments.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 p-6 text-center text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-950/50">
          No attachments yet.
        </div>
      ) : (
        <div className="space-y-2">
          {attachments.map((attachment) => {
            const Icon = iconFor(attachment.content_type);
            const canDelete = attachment.uploaded_by === currentUserId;
            return (
              <div
                key={attachment.id}
                className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-950/50"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">{attachment.file_name}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {formatBytes(attachment.file_size)} • {new Date(attachment.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Button variant="ghost" size="icon-sm" className="rounded-full" onClick={() => handleDownload(attachment.id)}>
                    <Download className="h-4 w-4" />
                  </Button>
                  {canDelete ? (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="rounded-full text-red-500 hover:text-red-600"
                      onClick={() => handleDelete(attachment.id)}
                      disabled={deletingId === attachment.id}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}