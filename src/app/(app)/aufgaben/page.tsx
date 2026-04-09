import { getTasks } from "@/actions/tasks";
import { getRequests } from "@/actions/requests";
import { TaskList } from "@/components/tasks/task-list";
import { currentUser } from "@clerk/nextjs/server";

export default async function AufgabenPage() {
  const [tasks, requests, user] = await Promise.all([getTasks(), getRequests(), currentUser()]);
  const currentUserName = user ? `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() : undefined;

  return (
    <div className="p-4 md:p-6 space-y-5">
      {/* Page header */}
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Aufgaben</h1>
        <p className="text-sm text-gray-400 mt-0.5">Team-Aufgaben und To-Dos verwalten</p>
      </div>

      <TaskList tasks={tasks} requests={requests} currentUserName={currentUserName} />
    </div>
  );
}
