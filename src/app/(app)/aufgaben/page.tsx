import { getTasks } from "@/actions/tasks";
import { getRequests } from "@/actions/requests";
import { TaskList } from "@/components/tasks/task-list";
import { CreateTaskDialog } from "@/components/tasks/create-task-dialog";

export default async function AufgabenPage() {
  const [tasks, requests] = await Promise.all([getTasks(), getRequests()]);

  return (
    <div className="p-6 space-y-5">
      {/* Page header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Aufgaben</h1>
          <p className="text-sm text-gray-400 mt-0.5">Team-Aufgaben und To-Dos verwalten</p>
        </div>
        <CreateTaskDialog />
      </div>

      <TaskList tasks={tasks} requests={requests} />
    </div>
  );
}
