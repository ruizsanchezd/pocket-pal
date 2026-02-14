import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { User, Camera, Loader2 } from 'lucide-react';
import { Profile } from '@/types/database';

export function ProfileSection() {
  const { user, profile, setProfileData } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [displayName, setDisplayName] = useState(profile?.display_name || '');
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  // Sync displayName when profile loads or changes externally
  useEffect(() => {
    setDisplayName(profile?.display_name || '');
  }, [profile?.display_name]);

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

  const handleSaveName = async () => {
    if (!user) return;

    setSaving(true);
    const { data, error } = await supabase.rpc('update_own_profile', {
      _display_name: displayName.trim() || null,
      _set_display_name: true,
    });

    if (error) {
      toast({
        variant: 'destructive',
        title: 'Error al actualizar nombre',
        description: error.message
      });
    } else if (data?.profile) {
      setProfileData(data.profile as Profile);
      toast({ title: 'Nombre actualizado' });
    } else {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No se pudo actualizar el nombre'
      });
    }
    setSaving(false);
  };

  const handlePhotoClick = () => {
    fileInputRef.current?.click();
  };

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Solo se permiten archivos de imagen'
      });
      return;
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'La imagen no puede superar los 2MB'
      });
      return;
    }

    setUploadingPhoto(true);

    try {
      // Upload to Supabase Storage
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/avatar.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, file, { upsert: true });

      if (uploadError) {
        toast({
          variant: 'destructive',
          title: 'Error al subir imagen',
          description: uploadError.message
        });
        setUploadingPhoto(false);
        return;
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName);

      // Update profile with avatar URL (add timestamp to bust cache)
      const avatarUrl = `${publicUrl}?t=${Date.now()}`;
      const { data: rpcData, error: updateError } = await supabase.rpc('update_own_profile', {
        _avatar_url: avatarUrl,
        _set_avatar_url: true,
      });

      if (updateError) {
        toast({
          variant: 'destructive',
          title: 'Error al guardar avatar',
          description: updateError.message
        });
        setUploadingPhoto(false);
        return;
      }

      if (rpcData?.profile) {
        setProfileData(rpcData.profile as Profile);
        toast({ title: 'Foto actualizada' });
      } else {
        toast({
          variant: 'destructive',
          title: 'Error',
          description: 'No se pudo guardar la foto de perfil'
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error desconocido';
      toast({
        variant: 'destructive',
        title: 'Error al subir foto',
        description: message
      });
    }

    setUploadingPhoto(false);
    // Clear input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <User className="h-5 w-5" />
          Perfil
        </CardTitle>
        <CardDescription>
          Personaliza tu nombre y foto de perfil
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Avatar section */}
        <div className="flex items-center gap-4">
          <div className="relative">
            <Avatar className="h-20 w-20">
              <AvatarImage src={profile?.avatar_url || undefined} alt={profile?.display_name || 'Usuario'} />
              <AvatarFallback className="text-lg">{getInitials()}</AvatarFallback>
            </Avatar>
            <button
              onClick={handlePhotoClick}
              disabled={uploadingPhoto}
              className="absolute bottom-0 right-0 p-1.5 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {uploadingPhoto ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Camera className="h-4 w-4" />
              )}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handlePhotoChange}
              className="hidden"
            />
          </div>
          <div className="flex-1">
            <p className="text-sm text-muted-foreground">
              Haz clic en el icono de cámara para cambiar tu foto de perfil.
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Formatos: JPG, PNG, GIF. Máximo 2MB.
            </p>
          </div>
        </div>

        {/* Name section */}
        <div className="space-y-2">
          <Label htmlFor="displayName">Nombre para mostrar</Label>
          <div className="flex gap-2">
            <Input
              id="displayName"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Tu nombre"
              className="flex-1"
            />
            <Button
              onClick={handleSaveName}
              disabled={saving || displayName === (profile?.display_name || '')}
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                'Guardar'
              )}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Este nombre aparecerá en el menú de usuario
          </p>
        </div>

        {/* Email (read-only) */}
        <div className="space-y-2">
          <Label>Email</Label>
          <Input
            value={user?.email || ''}
            disabled
            className="bg-muted"
          />
          <p className="text-xs text-muted-foreground">
            El email no se puede cambiar
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
