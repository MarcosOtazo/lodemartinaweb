import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { supabase } from '../../lib/supabase';
import { useConfigStore } from '../../store/config';
import type { SiteConfig } from '../../types';
import { cn, DAY_KEYS, DAY_LABELS, groupSchedule } from '../../lib/utils';

export default function AdminSettings() {
  const { config, updateConfig } = useConfigStore();
  const [form, setForm] = useState<SiteConfig>(config);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [footerFile, setFooterFile] = useState<File | null>(null);
  const [footerRemoved, setFooterRemoved] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm(config);
  }, [config]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      let logoUrl = form.logo_url;

      if (logoFile) {
        if (form.logo_url) {
          const oldPath = form.logo_url.split('/').pop();
          if (oldPath) await supabase.storage.from('product-images').remove([oldPath]);
        }
        const fileExt = logoFile.name.split('.').pop();
        const fileName = `logo-${Date.now()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from('product-images')
          .upload(fileName, logoFile);
        if (uploadError) throw uploadError;
        const { data: publicUrl } = supabase.storage
          .from('product-images')
          .getPublicUrl(fileName);
        logoUrl = publicUrl.publicUrl;
      }

      let footerUrl = form.footer_pattern_url;

      if (footerRemoved) {
        if (footerUrl) {
          const oldPath = footerUrl.split('/').pop();
          if (oldPath) await supabase.storage.from('product-images').remove([oldPath]);
        }
        footerUrl = null;
      } else if (footerFile) {
        if (footerUrl) {
          const oldPath = footerUrl.split('/').pop();
          if (oldPath) await supabase.storage.from('product-images').remove([oldPath]);
        }
        const fileExt = footerFile.name.split('.').pop();
        const fileName = `footer-${Date.now()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from('product-images')
          .upload(fileName, footerFile);
        if (uploadError) throw uploadError;
        const { data: publicUrl } = supabase.storage
          .from('product-images')
          .getPublicUrl(fileName);
        footerUrl = publicUrl.publicUrl;
      }

      const { error } = await updateConfig({
        site_name: form.site_name,
        logo_url: logoUrl,
        primary_color: form.primary_color,
        secondary_color: form.secondary_color,
        hero_title: form.hero_title,
        hero_subtitle: form.hero_subtitle,
        whatsapp_number: form.whatsapp_number,
        address: form.address,
        footer_pattern_url: footerUrl,
        delivery_fee: Number(form.delivery_fee),
        min_order_amount: Number(form.min_order_amount),
        opening_hours: form.opening_hours,
      });

      if (error) throw new Error(error);
      toast.success('Configuración guardada');
      setLogoFile(null);
      setFooterFile(null);
      setFooterRemoved(false);
    } catch (error) {
      console.error(error);
      toast.error('Error al guardar la configuración');
    } finally {
      setSaving(false);
    }
  };

  const inputClass = 'input';
  const labelClass = 'label';

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold mb-6">Configuración del sitio</h1>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Identidad */}
        <div className="card p-6">
          <h2 className="text-lg font-bold mb-4">Identidad</h2>
          <div className="space-y-4">
            <div>
              <label className={labelClass}>Nombre del negocio</label>
              <input
                className={inputClass}
                value={form.site_name}
                onChange={(e) => setForm({ ...form, site_name: e.target.value })}
                placeholder="Lo de Martina"
              />
            </div>
            <div>
              <label className={labelClass}>Logo</label>
              <div className="flex items-center gap-4">
                {(logoFile || form.logo_url) && (
                  <img
                    src={logoFile ? URL.createObjectURL(logoFile) : form.logo_url!}
                    alt="Logo"
                    className="h-16 w-16 rounded-full object-cover border border-gray-200"
                  />
                )}
                <label className="btn-secondary cursor-pointer">
                  {logoFile ? 'Cambiar logo' : form.logo_url ? 'Cambiar logo' : 'Subir logo'}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => setLogoFile(e.target.files?.[0] || null)}
                  />
                </label>
              </div>
            </div>
            <div>
              <label className={labelClass}>Título principal (hero)</label>
              <input
                className={inputClass}
                value={form.hero_title}
                onChange={(e) => setForm({ ...form, hero_title: e.target.value })}
              />
            </div>
            <div>
              <label className={labelClass}>Subtítulo</label>
              <textarea
                className={cn(inputClass, 'min-h-[70px] resize-y')}
                value={form.hero_subtitle}
                onChange={(e) => setForm({ ...form, hero_subtitle: e.target.value })}
              />
            </div>
          </div>
        </div>

        {/* Fondo del footer */}
        <div className="card p-6">
          <h2 className="text-lg font-bold mb-4">Fondo del footer</h2>
          <div className="flex items-center gap-4 flex-wrap">
            {(footerFile || (!footerRemoved && form.footer_pattern_url)) && (
              <img
                src={footerFile ? URL.createObjectURL(footerFile) : form.footer_pattern_url!}
                alt="Patrón del footer"
                className="h-24 w-24 rounded-lg object-cover border border-gray-200"
              />
            )}
            <div className="space-x-2">
              <label className="btn-secondary cursor-pointer">
                {footerFile ? 'Cambiar imagen' : form.footer_pattern_url ? 'Cambiar imagen' : 'Subir imagen'}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    setFooterFile(e.target.files?.[0] || null);
                    setFooterRemoved(false);
                  }}
                />
              </label>
              {(form.footer_pattern_url || footerFile) && !footerRemoved && (
                <button
                  type="button"
                  onClick={() => {
                    setFooterFile(null);
                    setFooterRemoved(true);
                  }}
                  className="btn-ghost text-red-600 hover:bg-red-50"
                >
                  Quitar imagen
                </button>
              )}
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-2">
            Se repite como patrón sobre la imagen de fondo del footer. Funciona mejor con
            imágenes chicas (300-500px) y PNG con transparencia.
          </p>
        </div>

        {/* Colores */}
        <div className="card p-6">
          <h2 className="text-lg font-bold mb-4">Colores</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Color principal</label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  className="h-11 w-16 rounded-lg border border-gray-200 cursor-pointer"
                  value={form.primary_color}
                  onChange={(e) => setForm({ ...form, primary_color: e.target.value })}
                />
                <input
                  className={inputClass}
                  value={form.primary_color}
                  onChange={(e) => setForm({ ...form, primary_color: e.target.value })}
                />
              </div>
              <p className="text-xs text-gray-400 mt-1">Botones, acentos, links</p>
            </div>
            <div>
              <label className={labelClass}>Color secundario</label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  className="h-11 w-16 rounded-lg border border-gray-200 cursor-pointer"
                  value={form.secondary_color}
                  onChange={(e) => setForm({ ...form, secondary_color: e.target.value })}
                />
                <input
                  className={inputClass}
                  value={form.secondary_color}
                  onChange={(e) => setForm({ ...form, secondary_color: e.target.value })}
                />
              </div>
              <p className="text-xs text-gray-400 mt-1">Fondo del hero y footer</p>
            </div>
          </div>
        </div>

        {/* Pedidos */}
        <div className="card p-6">
          <h2 className="text-lg font-bold mb-4">Pedidos</h2>
          <div className="space-y-4">
            <div>
              <label className={labelClass}>Número de WhatsApp (recibe pedidos)</label>
              <input
                className={inputClass}
                value={form.whatsapp_number}
                onChange={(e) => setForm({ ...form, whatsapp_number: e.target.value })}
                placeholder="5491123456789 (código de país + número, sin +)"
              />
            </div>
            <div>
              <label className={labelClass}>Dirección del local</label>
              <input
                className={inputClass}
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                placeholder="Ej: San Martín 1311, Paso de los Libres, Corrientes"
              />
              <p className="text-xs text-gray-400 mt-1">
                Se muestra en el footer con un botón "Cómo llegar" que abre Google Maps.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Costo de envío ($)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className={inputClass}
                  value={form.delivery_fee}
                  onChange={(e) => setForm({ ...form, delivery_fee: Number(e.target.value) })}
                />
              </div>
              <div>
                <label className={labelClass}>Pedido mínimo ($)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className={inputClass}
                  value={form.min_order_amount}
                  onChange={(e) => setForm({ ...form, min_order_amount: Number(e.target.value) })}
                />
                <p className="text-xs text-gray-400 mt-1">0 = sin mínimo</p>
              </div>
            </div>
            <div>
              <label className={labelClass}>Días y horarios</label>
              <div className="rounded-xl border border-gray-200 divide-y divide-gray-100">
                {DAY_KEYS.map((key) => {
                  const day = form.opening_hours[key] || { open: '20:00', close: '00:00', closed: false };
                  return (
                    <div key={key} className="flex items-center gap-3 px-3 py-2.5 flex-wrap">
                      <span className="w-24 font-medium text-sm text-gray-700">{DAY_LABELS[key]}</span>
                      <label className="flex items-center gap-2 text-sm text-gray-600">
                        <input
                          type="checkbox"
                          checked={day.closed}
                          onChange={(e) =>
                            setForm({
                              ...form,
                              opening_hours: {
                                ...form.opening_hours,
                                [key]: { ...day, closed: e.target.checked },
                              },
                            })
                          }
                        />
                        Cerrado
                      </label>
                      {!day.closed && (
                        <div className="flex items-center gap-2">
                          <input
                            type="time"
                            className="input w-auto px-2 py-1.5 text-sm"
                            value={day.open}
                            onChange={(e) =>
                              setForm({
                                ...form,
                                opening_hours: {
                                  ...form.opening_hours,
                                  [key]: { ...day, open: e.target.value },
                                },
                              })
                            }
                          />
                          <span className="text-sm text-gray-400">a</span>
                          <input
                            type="time"
                            className="input w-auto px-2 py-1.5 text-sm"
                            value={day.close}
                            onChange={(e) =>
                              setForm({
                                ...form,
                                opening_hours: {
                                  ...form.opening_hours,
                                  [key]: { ...day, close: e.target.value },
                                },
                              })
                            }
                          />
                          <span className="text-sm text-gray-400">hs</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              <p className="text-xs text-gray-400 mt-1">
                La web calcula automáticamente si está abierto o cerrado según estos horarios.
              </p>
              <div className="mt-3 text-sm text-gray-500 bg-gray-50 rounded-lg p-3">
                <p className="font-semibold text-gray-700 mb-1">Así se va a mostrar:</p>
                {groupSchedule(form.opening_hours).map((g, i) => (
                  <p key={i}>
                    <span className="font-medium">{g.days}:</span> {g.range}
                  </p>
                ))}
              </div>
            </div>
          </div>
        </div>

        <button type="submit" className="btn-primary w-full py-3 text-lg" disabled={saving}>
          {saving ? 'Guardando...' : 'Guardar cambios'}
        </button>
      </form>
    </div>
  );
}
