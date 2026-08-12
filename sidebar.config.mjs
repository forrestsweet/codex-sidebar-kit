export default {
  appId: "codex-sidebar-kit-demo",
  name: "Codex Sidebar Kit",
  sectionLabel: "My Workspace",
  repositoryUrl: "https://github.com/forrestsweet/codex-sidebar-kit",
  menus: [
    {
      id: "tasks",
      label: "Agent Tasks",
      description: "Send structured work to a native Codex task.",
      icon: "check-square",
      path: "/app/tasks",
      capabilities: ["context", "native-task", "open-thread"],
      skill: "skills/sidebar-tasks",
    },
    {
      id: "links",
      label: "Quick Links",
      description: "Keep the tools you use every day one click away.",
      icon: "link",
      path: "/app/links",
      capabilities: ["context"],
    },
    {
      id: "docs",
      label: "Project Guide",
      description: "Turn project context into clear next actions.",
      icon: "book-open",
      path: "/app/docs",
      capabilities: ["context", "native-task"],
      skill: "skills/sidebar-tasks",
    },
  ],
};
