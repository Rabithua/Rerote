import { Link } from '@tanstack/react-router'

export function NotFound() {
  return (
    <div className="min-h-screen flex flex-col p-4 bg-gray-50">
      <div className="flex-1 flex flex-col justify-center gap-4 max-w-md">
        <div className="text-9xl font-bold text-gray-200">404</div>
        <div className="text-3xl font-bold text-gray-900">Page Not Found</div>
        <div className="text-gray-600">
          The page you are looking for does not exist or has been moved.
        </div>
        <div className="pt-4">
          <Link
            to="/"
            className="inline-flex items-center gap-2 px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-gray-900 hover:bg-gray-800 transition-colors duration-200"
          >
            Return to Home
          </Link>
        </div>
      </div>
    </div>
  )
}
