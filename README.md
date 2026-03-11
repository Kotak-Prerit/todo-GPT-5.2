This todo app is made with gpt-5.2  using copilot in about 10 mins. Below is the prompt :

Build a Todo List web app using **Vite + TypeScript + TailwindCSS**.

Features:

* Add task
* Nested subtasks (unlimited depth)
* Toggle complete
* Edit task (inline)
* Delete task
* Filters: All, Active, Completed
* Collapse/expand subtasks

Requirements:

* Persist data in LocalStorage
* Each task: checkbox, text, delete button, add subtask option
* Completed tasks show strikethrough
* Double-click task to edit
* Parent completion reflects subtasks state
* Recursive rendering for nested todos
* Responsive layout

UI:

* **Dark mode only**
* Minimal modern design
* Centered container
* Input at top, tasks below, filters at bottom
* Indented nested subtasks

Data model:

```ts
interface Todo {
  id: string
  text: string
  completed: boolean
  children?: Todo[]
}
```

Output:

* Full project structure
* Clean typed TypeScript
* Tailwind styling
