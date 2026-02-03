import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import {
  Settings,
  LogOut,
  ChevronDown
} from 'lucide-react';

interface MainLayoutProps {
  children: React.ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  const { user, profile, signOut } = useAuth();

  const handleSignOut = async () => {
    await signOut();
  };

  // Get user initials for avatar fallback
  const getInitials = () => {
    if (profile?.display_name) {
      return profile.display_name
        .split(' ')
        .map(n => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
    }
    if (user?.email) {
      return user.email[0].toUpperCase();
    }
    return 'U';
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 items-center">
          {/* Logo - links to home (movimientos) */}
          <Link to="/movimientos" className="flex items-center gap-2">
            <svg width="24" height="24" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-primary">
              <path d="M15.9986 24.25C20.0702 24.25 23.401 21.1705 23.7041 17.2703L26.4959 17.4797C26.0816 22.8089 21.5385 27 15.9986 27C10.4589 26.9997 5.91836 22.8084 5.5041 17.4797L8.2959 17.2703C8.59909 21.1705 11.9277 24.2497 15.9986 24.25Z" fill="currentColor"/>
              <path fillRule="evenodd" clipRule="evenodd" d="M13.9 17.375H11.1V14.625H10.0814C7.51909 14.4351 5.50052 12.3547 5.5 9.81384C5.5 7.27247 7.51873 5.18986 10.0814 5H13.9V7.75H26.5V11.5004C26.3067 14.0173 24.1862 16 21.5986 16C19.0115 15.9995 16.8933 14.017 16.7 11.5004V10.5H13.9V17.375ZM19.5 11.7501C19.5829 12.5891 20.4911 13.2499 21.6 13.25C22.7088 13.2499 23.6172 12.589 23.7 11.7501V10.5H19.5V11.7501ZM9.82715 7.75C8.97299 7.83136 8.30013 8.72348 8.3 9.8125C8.30006 10.9016 8.97296 11.7936 9.82715 11.875H11.1V7.75H9.82715Z" fill="currentColor"/>
            </svg>
            <span className="font-bold text-lg hidden sm:inline-block">
              PocketPal
            </span>
          </Link>

          {/* User menu */}
          <div className="ml-auto">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-2">
                  <Avatar className="h-7 w-7">
                    <AvatarImage src={profile?.avatar_url || undefined} alt={profile?.display_name || 'Usuario'} />
                    <AvatarFallback className="text-xs">{getInitials()}</AvatarFallback>
                  </Avatar>
                  <span className="hidden sm:inline-block max-w-[150px] truncate">
                    {profile?.display_name || 'Usuario'}
                  </span>
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <div className="flex items-center gap-3 px-2 py-2">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={profile?.avatar_url || undefined} alt={profile?.display_name || 'Usuario'} />
                    <AvatarFallback>{getInitials()}</AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col">
                    <p className="text-sm font-medium">
                      {profile?.display_name || 'Usuario'}
                    </p>
                    <p className="text-xs text-muted-foreground truncate max-w-[160px]">
                      {user?.email}
                    </p>
                  </div>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/configuracion" className="cursor-pointer">
                    <Settings className="mr-2 h-4 w-4" />
                    Configuración
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut} className="cursor-pointer text-destructive">
                  <LogOut className="mr-2 h-4 w-4" />
                  Cerrar sesión
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="container py-6">
        {children}
      </main>
    </div>
  );
}
