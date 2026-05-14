import { createFileRoute, Outlet, Link } from '@tanstack/react-router'

export const Route = createFileRoute('/admin')({
    component: AdminLayout,
})

function AdminLayout() {
    return (
        <div style={{ display: 'flex' }}>
            <aside
                style={{
                    width: 220,
                    borderRight: '1px solid #ccc',
                    padding: 16,
                }}
            >
                <h3>Admin Menu</h3>

                <ul>
                    <li>
                        <Link to="/admin/users">
                            Quản lý người dùng
                        </Link>
                    </li>

                    <li>
                        <Link to="/admin/groups">
                            Quản lý nhóm
                        </Link>
                    </li>
                </ul>
            </aside>

            <main style={{ padding: 16 }}>
                <Outlet />
            </main>
        </div>
    )
}