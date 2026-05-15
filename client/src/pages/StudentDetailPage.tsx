import { useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Pencil, Archive, Trash2 } from 'lucide-react';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import StudentFormDialog from '@/components/StudentFormDialog';
import { useRole } from '@/hooks/useRole';
import InteractionsTab from '@/components/InteractionsTab';
import OutcomesTab from '@/components/OutcomesTab';
import ProgressTab from '@/components/ProgressTab';
import ContactsTab from '@/components/ContactsTab';
import FollowUpsTab from '@/components/FollowUpsTab';

export default function StudentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const qc = useQueryClient();
  const { canWrite } = useRole();
  const [editOpen, setEditOpen] = useState(false);
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'interactions');

  const { data: student, isLoading } = useQuery({
    queryKey: ['student', id],
    queryFn: async () => {
      const { data } = await api.get(`/students/${id}`);
      return data;
    },
  });

  const archiveMutation = useMutation({
    mutationFn: () => api.put(`/students/${id}`, { archived: !student.archived }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['student', id] }),
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/students/${id}`),
    onSuccess: () => navigate('/students'),
  });

  if (isLoading) return <div className="p-6 text-muted-foreground text-sm">Loading…</div>;
  if (!student) return <div className="p-6 text-muted-foreground text-sm">Student not found.</div>;

  return (
    <div className="p-6 max-w-5xl">
      <button
        onClick={() => navigate('/students')}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Students
      </button>

      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold">{student.fullName}</h1>
            {student.archived ? (
              <Badge variant="secondary">Archived</Badge>
            ) : student.inactive ? (
              <Badge variant="warning">Inactive</Badge>
            ) : (
              <Badge variant="success">Active</Badge>
            )}
          </div>
          <div className="mt-1 text-sm text-muted-foreground space-x-3">
            {student.enrollment?.program && <span>{student.enrollment.program}</span>}
            {student.enrollment?.currentCourse && <span>· {student.enrollment.currentCourse}</span>}
            {student.enrollment?.pace && <span>· {student.enrollment.pace}</span>}
          </div>
          {student.statusNote && (
            <p className="mt-2 text-sm text-muted-foreground italic">{student.statusNote}</p>
          )}
        </div>

        {canWrite && (
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
              <Pencil className="h-4 w-4" />
              Edit
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => archiveMutation.mutate()}
              disabled={archiveMutation.isPending}
            >
              <Archive className="h-4 w-4" />
              {student.archived ? 'Unarchive' : 'Archive'}
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => {
                if (confirm(`Delete ${student.fullName}? This cannot be undone.`)) {
                  deleteMutation.mutate();
                }
              }}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="interactions">Interactions</TabsTrigger>
          <TabsTrigger value="outcomes">Outcomes</TabsTrigger>
          <TabsTrigger value="followups">Follow-ups</TabsTrigger>
          <TabsTrigger value="contacts">Contacts</TabsTrigger>
          <TabsTrigger value="progress">Progress</TabsTrigger>
        </TabsList>
        <TabsContent value="interactions">
          <InteractionsTab studentId={id!} />
        </TabsContent>
        <TabsContent value="outcomes">
          <OutcomesTab studentId={id!} />
        </TabsContent>
        <TabsContent value="followups">
          <FollowUpsTab studentId={id!} />
        </TabsContent>
        <TabsContent value="contacts">
          <ContactsTab studentId={id!} contacts={student.contacts || []} />
        </TabsContent>
        <TabsContent value="progress">
          <ProgressTab studentId={id!} />
        </TabsContent>
      </Tabs>

      <StudentFormDialog open={editOpen} onOpenChange={setEditOpen} student={student} />
    </div>
  );
}
