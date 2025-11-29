import { Outlet } from "react-router-dom"

export default function Settings() {
  return (
    <div className="flex flex-1 flex-col gap-4 p-4 lg:p-6 min-h-0 overflow-hidden">
      <div className="flex items-center">
        <h1 className="text-lg font-semibold md:text-2xl">Settings</h1>
      </div>
      <Outlet />
    </div>
  )
}
