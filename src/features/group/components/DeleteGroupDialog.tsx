import { useTranslation } from 'react-i18next';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useDeleteGroup } from '../queries';
import type { Group } from '../types';

interface DeleteGroupDialogProps {
  open: boolean;
  onOpenChange: (isOpen: boolean) => void;
  group: Group | null;
}

export function DeleteGroupDialog({ open, onOpenChange, group }: DeleteGroupDialogProps) {
  const { mutate: deleteGroup, isPending } = useDeleteGroup();

  if (!group) return null;

  const handleDelete = () => {
    deleteGroup(group.id, {
      onSuccess: () => {
        onOpenChange(false);
      }
    });
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Xóa nhóm</AlertDialogTitle>
          <AlertDialogDescription>
            Bạn có chắc chắn muốn xóa nhóm <span className="font-semibold text-foreground">{group.name}</span> không?
            Hành động này không thể hoàn tác và tất cả các thành viên trong nhóm sẽ bị xóa khỏi nhóm này.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Hủy</AlertDialogCancel>
          <AlertDialogAction 
            onClick={(e) => {
              e.preventDefault();
              handleDelete();
            }} 
            disabled={isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isPending ? 'Đang xóa...' : 'Chắc chắn xóa'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
