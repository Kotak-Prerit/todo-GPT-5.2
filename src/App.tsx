import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
  type RefObject,
  type SetStateAction,
} from 'react'
import {
  FiCheck,
  FiChevronDown,
  FiChevronRight,
  FiEdit2,
  FiPlus,
  FiTrash2,
} from 'react-icons/fi'

export interface Todo {
  id: string
  text: string
  completed: boolean
  children?: Todo[]
}

type Filter = 'all' | 'active' | 'completed'

const STORAGE_KEY = 'nested-todos.v1'

function createId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }

  return `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`
}

function normalizeTodo(todo: Todo): Todo {
  const children = todo.children?.map(normalizeTodo)
  const hasChildren = (children?.length ?? 0) > 0

  if (!hasChildren) {
    return { ...todo, children }
  }

  const allChildrenCompleted = children!.every((c) => c.completed)
  return { ...todo, children, completed: allChildrenCompleted }
}

function normalizeTree(todos: Todo[]): Todo[] {
  return todos.map(normalizeTodo)
}

function setSubtreeCompleted(todo: Todo, completed: boolean): Todo {
  const children = todo.children?.map((c) => setSubtreeCompleted(c, completed))
  return { ...todo, completed, children }
}

function updateTree(
  todos: Todo[],
  id: string,
  updater: (todo: Todo) => Todo,
): Todo[] {
  return todos.map((t) => {
    if (t.id === id) return updater(t)
    if (!t.children?.length) return t
    return { ...t, children: updateTree(t.children, id, updater) }
  })
}

function removeFromTree(todos: Todo[], id: string): Todo[] {
  return todos
    .filter((t) => t.id !== id)
    .map((t) => {
      if (!t.children?.length) return t
      return { ...t, children: removeFromTree(t.children, id) }
    })
}

function addChildToTree(todos: Todo[], parentId: string, child: Todo): Todo[] {
  return todos.map((t) => {
    if (t.id === parentId) {
      const nextChildren = [...(t.children ?? []), child]
      return { ...t, children: nextChildren }
    }

    if (!t.children?.length) return t
    return { ...t, children: addChildToTree(t.children, parentId, child) }
  })
}

function matchesFilter(todo: Todo, filter: Filter): boolean {
  if (filter === 'all') return true
  if (filter === 'active') return !todo.completed
  return todo.completed
}

function filterTree(todos: Todo[], filter: Filter): Todo[] {
  if (filter === 'all') return todos

  const result: Todo[] = []
  for (const todo of todos) {
    const filteredChildren = todo.children ? filterTree(todo.children, filter) : undefined
    const childMatches = (filteredChildren?.length ?? 0) > 0
    const selfMatches = matchesFilter(todo, filter)

    if (selfMatches || childMatches) {
      result.push({ ...todo, children: filteredChildren })
    }
  }

  return result
}

function countRemaining(todos: Todo[]): number {
  let count = 0
  for (const t of todos) {
    if (!t.completed) count += 1
    if (t.children?.length) count += countRemaining(t.children)
  }
  return count
}

function FilterButton({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        active
          ? 'rounded-md bg-zinc-800 px-3 py-1.5 text-sm text-zinc-50'
          : 'rounded-md px-3 py-1.5 text-sm text-zinc-300 hover:bg-zinc-900 hover:text-zinc-50'
      }
    >
      {label}
    </button>
  )
}

function IconButton({
  label,
  onClick,
  children,
  className,
}: {
  label: string
  onClick: () => void
  children: ReactNode
  className?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={
        className ??
        'grid h-8 w-8 place-items-center rounded-md text-zinc-300 hover:bg-zinc-900 hover:text-zinc-50'
      }
    >
      {children}
    </button>
  )
}

function Checkbox({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: (checked: boolean) => void
  label: string
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onChange(!checked)
        }
      }}
      className={
        checked
          ? 'grid h-4 w-4 place-items-center rounded-sm cursor-pointer border border-zinc-400 bg-zinc-100 text-zinc-950'
          : 'grid h-4 w-4 place-items-center rounded-sm cursor-pointer border border-zinc-600 bg-zinc-950 text-transparent hover:border-zinc-400'
      }
    >
      <FiCheck size={14} />
    </button>
  )
}

function TodoNode({
  todo,
  depth,
  collapsedIds,
  toggleCollapsed,
  toggleTodo,
  deleteTodo,
  beginAddSubtask,
  addingParentId,
  subtaskText,
  setSubtaskText,
  commitAddSubtask,
  cancelAddSubtask,
  editingId,
  editingText,
  setEditingText,
  editInputRef,
  commitEdit,
  startEdit,
  cancelEdit,
}: {
  todo: Todo
  depth: number
  collapsedIds: Set<string>
  toggleCollapsed: (id: string) => void
  toggleTodo: (id: string, completed: boolean) => void
  deleteTodo: (id: string) => void
  beginAddSubtask: (parentId: string) => void
  addingParentId: string | null
  subtaskText: string
  setSubtaskText: Dispatch<SetStateAction<string>>
  commitAddSubtask: (parentId: string) => void
  cancelAddSubtask: () => void
  editingId: string | null
  editingText: string
  setEditingText: Dispatch<SetStateAction<string>>
  editInputRef: RefObject<HTMLInputElement | null>
  commitEdit: (id: string) => void
  startEdit: (todo: Todo) => void
  cancelEdit: () => void
}) {
  const hasChildren = (todo.children?.length ?? 0) > 0
  const collapsed = collapsedIds.has(todo.id)
  const isEditing = editingId === todo.id
  const isAddingSubtask = addingParentId === todo.id

  const rowClassName = todo.completed
    ? 'group flex items-center gap-2 rounded-lg border border-emerald-900 bg-emerald-950/40 px-3 py-2'
    : 'group flex items-center gap-2 rounded-lg border border-zinc-900 bg-zinc-950/40 px-3 py-2'

  return (
    <div>
      <div className={rowClassName} style={{ paddingLeft: 12 + depth * 18 }}>
        {hasChildren ? (
          <IconButton
            label={collapsed ? 'Expand subtasks' : 'Collapse subtasks'}
            onClick={() => toggleCollapsed(todo.id)}
            className="grid h-8 w-8 place-items-center rounded-md text-zinc-300 hover:bg-zinc-900 hover:text-zinc-50"
          >
            {collapsed ? <FiChevronRight size={16} /> : <FiChevronDown size={16} />}
          </IconButton>
        ) : (
          <span className="h-8 w-8" />
        )}

        <Checkbox
          checked={todo.completed}
          onChange={(checked) => toggleTodo(todo.id, checked)}
          label={todo.completed ? 'Mark as incomplete' : 'Mark as complete'}
        />

        <div className="min-w-0 flex-1">
          {isEditing ? (
            <input
              ref={editInputRef}
              value={editingText}
              onChange={(e) => setEditingText(e.target.value)}
              onBlur={() => commitEdit(todo.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitEdit(todo.id)
                if (e.key === 'Escape') cancelEdit()
              }}
              className="w-full rounded-md border border-zinc-800 bg-zinc-950 px-2 py-1 text-sm text-zinc-50 outline-none focus:border-zinc-600"
            />
          ) : (
            <div
              onDoubleClick={() => startEdit(todo)}
              className={
                todo.completed
                  ? 'truncate text-sm text-zinc-400 line-through'
                  : 'truncate text-sm text-zinc-100'
              }
              title="Double-click to edit"
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter') startEdit(todo)
              }}
            >
              {todo.text}
            </div>
          )}
        </div>

        {!isEditing ? (
          <IconButton label="Edit task" onClick={() => startEdit(todo)}>
            <FiEdit2 size={16} />
          </IconButton>
        ) : null}

        <IconButton label="Add subtask" onClick={() => beginAddSubtask(todo.id)}>
          <FiPlus size={16} />
        </IconButton>

        <IconButton
          label="Delete task"
          onClick={() => deleteTodo(todo.id)}
          className="grid h-8 w-8 place-items-center rounded-md text-zinc-300 hover:bg-zinc-900 hover:text-red-200"
        >
          <FiTrash2 size={16} />
        </IconButton>
      </div>

      {isAddingSubtask ? (
        <div className="mt-2 flex items-center gap-2" style={{ paddingLeft: 12 + (depth + 1) * 18 }}>
          <span className="h-8 w-8" />
          <span className="h-5 w-5" />
          <input
            value={subtaskText}
            onChange={(e) => setSubtaskText(e.target.value)}
            onBlur={() => cancelAddSubtask()}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitAddSubtask(todo.id)
              if (e.key === 'Escape') cancelAddSubtask()
            }}
            placeholder="Add subtask…"
            className="w-full rounded-md border border-zinc-800 bg-zinc-950 px-2 py-1 text-sm text-zinc-50 outline-none placeholder:text-zinc-600 focus:border-zinc-600"
            autoFocus
          />
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => commitAddSubtask(todo.id)}
            className="rounded-md bg-zinc-100 px-2 py-1 text-xs font-medium text-zinc-950 hover:bg-white"
          >
            Add
          </button>
        </div>
      ) : null}

      {hasChildren && !collapsed ? (
        <div className="mt-2 space-y-2">
          {todo.children!.map((child) => (
            <TodoNode
              key={child.id}
              todo={child}
              depth={depth + 1}
              collapsedIds={collapsedIds}
              toggleCollapsed={toggleCollapsed}
              toggleTodo={toggleTodo}
              deleteTodo={deleteTodo}
              beginAddSubtask={beginAddSubtask}
              addingParentId={addingParentId}
              subtaskText={subtaskText}
              setSubtaskText={setSubtaskText}
              commitAddSubtask={commitAddSubtask}
              cancelAddSubtask={cancelAddSubtask}
              editingId={editingId}
              editingText={editingText}
              setEditingText={setEditingText}
              editInputRef={editInputRef}
              commitEdit={commitEdit}
              startEdit={startEdit}
              cancelEdit={cancelEdit}
            />
          ))}
        </div>
      ) : null}
    </div>
  )
}

function App() {
  const [todos, setTodos] = useState<Todo[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return []
      const parsed = JSON.parse(raw) as unknown
      if (!Array.isArray(parsed)) return []
      return normalizeTree(parsed as Todo[])
    } catch {
      return []
    }
  })

  const [filter, setFilter] = useState<Filter>('all')
  const [newText, setNewText] = useState('')
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(() => new Set())

  const [addingParentId, setAddingParentId] = useState<string | null>(null)
  const [subtaskText, setSubtaskText] = useState('')

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingText, setEditingText] = useState('')
  const editInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(todos))
  }, [todos])

  useEffect(() => {
    if (!editingId) return
    editInputRef.current?.focus()
    editInputRef.current?.select()
  }, [editingId])

  const visibleTodos = useMemo(() => filterTree(todos, filter), [todos, filter])
  const remainingCount = useMemo(() => countRemaining(todos), [todos])

  function commitEdit(id: string) {
    const next = editingText.trim()
    setEditingId(null)
    setEditingText('')

    if (next.length === 0) {
      setTodos((prev) => normalizeTree(removeFromTree(prev, id)))
      return
    }

    setTodos((prev) => normalizeTree(updateTree(prev, id, (t) => ({ ...t, text: next }))))
  }

  function addRootTodo() {
    const text = newText.trim()
    if (!text) return

    const todo: Todo = {
      id: createId(),
      text,
      completed: false,
      children: [],
    }

    setTodos((prev) => normalizeTree([...prev, todo]))
    setNewText('')
  }

  function toggleTodo(id: string, completed: boolean) {
    setTodos((prev) => normalizeTree(updateTree(prev, id, (t) => setSubtreeCompleted(t, completed))))
  }

  function deleteTodo(id: string) {
    setTodos((prev) => normalizeTree(removeFromTree(prev, id)))
  }

  function beginAddSubtask(parentId: string) {
    setAddingParentId(parentId)
    setSubtaskText('')
  }

  function commitAddSubtask(parentId: string) {
    const text = subtaskText.trim()
    if (!text) return
    const child: Todo = { id: createId(), text, completed: false, children: [] }
    setTodos((prev) => normalizeTree(addChildToTree(prev, parentId, child)))
    setAddingParentId(null)
    setSubtaskText('')
  }

  function cancelAddSubtask() {
    setAddingParentId(null)
    setSubtaskText('')
  }

  function toggleCollapsed(id: string) {
    setCollapsedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function startEdit(todo: Todo) {
    setEditingId(todo.id)
    setEditingText(todo.text)
  }

  function cancelEdit() {
    setEditingId(null)
    setEditingText('')
  }

  return (
    <div className="min-h-screen px-4 py-10">
      <div className="mx-auto w-full max-w-2xl">
        <header className="mb-6">
          <h1 className="text-balance text-2xl font-semibold tracking-tight text-zinc-50">
            Todo
          </h1>
          <p className="mt-1 text-sm text-zinc-400">{remainingCount} active item(s)</p>
        </header>

        <div className="rounded-2xl border border-zinc-900 bg-zinc-950/50 p-4">
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              addRootTodo()
            }}
          >
            <input
              value={newText}
              onChange={(e) => setNewText(e.target.value)}
              placeholder="Add a task…"
              className="flex-1 rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-50 outline-none placeholder:text-zinc-600 focus:border-zinc-600"
            />
            <button
              type="submit"
              className="rounded-xl bg-zinc-100 px-3 py-2 text-sm font-medium text-zinc-950 hover:bg-white"
            >
              Add
            </button>
          </form>

          <div className="mt-4 space-y-2">
            {visibleTodos.length === 0 ? (
              <div className="rounded-xl border border-dashed border-zinc-900 px-4 py-8 text-center text-sm text-zinc-500">
                No tasks
              </div>
            ) : (
              visibleTodos.map((t) => (
                <TodoNode
                  key={t.id}
                  todo={t}
                  depth={0}
                  collapsedIds={collapsedIds}
                  toggleCollapsed={toggleCollapsed}
                  toggleTodo={toggleTodo}
                  deleteTodo={deleteTodo}
                  beginAddSubtask={beginAddSubtask}
                  addingParentId={addingParentId}
                  subtaskText={subtaskText}
                  setSubtaskText={setSubtaskText}
                  commitAddSubtask={commitAddSubtask}
                  cancelAddSubtask={cancelAddSubtask}
                  editingId={editingId}
                  editingText={editingText}
                  setEditingText={setEditingText}
                  editInputRef={editInputRef}
                  commitEdit={commitEdit}
                  startEdit={startEdit}
                  cancelEdit={cancelEdit}
                />
              ))
            )}
          </div>

          <footer className="mt-5 flex items-center justify-between gap-3 border-t border-zinc-900 pt-4">
            <div className="text-xs text-zinc-500">Click the edit button or double-click a task to edit</div>
            <div className="flex items-center gap-1 rounded-lg bg-zinc-950 p-1">
              <FilterButton label="All" active={filter === 'all'} onClick={() => setFilter('all')} />
              <FilterButton
                label="Active"
                active={filter === 'active'}
                onClick={() => setFilter('active')}
              />
              <FilterButton
                label="Completed"
                active={filter === 'completed'}
                onClick={() => setFilter('completed')}
              />
            </div>
          </footer>
        </div>
      </div>
    </div>
  )
}

export default App
