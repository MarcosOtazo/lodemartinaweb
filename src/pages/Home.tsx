import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, Clock } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useConfigStore } from '../store/config';
import type { Category } from '../types';
import { cn, commonSchedule, computeIsOpen, groupSchedule } from '../lib/utils';

const FALLBACK_EMOJIS: Record<string, string> = {
  hamburguesas: '🍔',
  tostadas: '🥪',
  combos: '🍟',
  bebidas: '🥤',
};

export default function Home() {
  const config = useConfigStore((s) => s.config);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [hoursOpen, setHoursOpen] = useState(false);

  useEffect(() => {
    supabase
      .from('categories')
      .select('*')
      .order('sort_order')
      .then(({ data }) => {
        setCategories((data || []) as Category[]);
        setLoading(false);
      });
  }, []);

  const isOpen = computeIsOpen(config.opening_hours);
  const commonHours = commonSchedule(config.opening_hours);

  return (
    <div className="container-main py-4 sm:py-6">
      {/* Estado del local */}
      <div
        className={cn(
          'flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold mb-2',
          isOpen ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'
        )}
      >
        <span className={cn('h-2.5 w-2.5 rounded-full', isOpen ? 'bg-green-500 animate-pulse' : 'bg-red-500')} />
        {isOpen ? (
          <span>
            Estamos abiertos{commonHours ? <span className="font-medium"> · {commonHours}</span> : ''}
          </span>
        ) : (
          <span>
            Cerrado por el momento{commonHours ? <span className="font-medium"> · {commonHours}</span> : ''}
          </span>
        )}
      </div>

      {/* Solapa de días y horarios */}
      <div className="mb-4 sm:mb-6">
        <button
          onClick={() => setHoursOpen(!hoursOpen)}
          className="w-full flex items-center justify-between px-4 py-2.5 rounded-xl bg-white border border-gray-200 text-sm font-semibold text-gray-700 hover:border-gray-300 transition-colors"
        >
          <span className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-primary" />
            Días que trabajamos
          </span>
          <ChevronDown className={cn('h-4 w-4 transition-transform', hoursOpen && 'rotate-180')} />
        </button>
        {hoursOpen && (
          <div className="mt-2 px-4 py-3 rounded-xl bg-white border border-gray-200 text-sm text-gray-600">
            {groupSchedule(config.opening_hours).map((g, i) => (
              <div key={i} className="flex justify-between items-center py-1">
                <span className="font-medium">{g.days}</span>
                <span className="font-bold text-gray-900">{g.range}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Título */}
      <div className="mb-4">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900">{config.site_name}</h1>
        <p className="text-gray-500 text-sm sm:text-base mt-1">{config.hero_subtitle}</p>
      </div>

      {/* Imagen principal */}
      {config.hero_image_url && (
        <div className="mb-4 sm:mb-6">
          <img
            src={config.hero_image_url}
            alt={config.site_name}
            className="w-full h-40 sm:h-64 rounded-2xl object-cover shadow-sm"
          />
        </div>
      )}

      {/* Categorías con imágenes (mobile-first) */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-28 sm:h-32 rounded-2xl bg-gray-200 animate-pulse" />
          ))}
        </div>
      ) : categories.length === 0 ? (
        <div className="text-center py-12 card">
          <span className="text-5xl block mb-3">🍽️</span>
          <p className="font-semibold">Todavía no hay categorías cargadas</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {categories.map((cat) => (
            <Link
              key={cat.id}
              to={`/menu?categoria=${cat.id}`}
              className="relative h-28 sm:h-36 rounded-2xl overflow-hidden group shadow-sm"
            >
              {cat.image_url ? (
                <img
                  src={cat.image_url}
                  alt={cat.name}
                  className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                  loading="lazy"
                />
              ) : (
                <div className="absolute inset-0 bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
                  <span className="text-5xl">{FALLBACK_EMOJIS[cat.id] || '🍽️'}</span>
                </div>
              )}
              <div className="absolute inset-0 bg-black/40" />
              <div className="absolute inset-0 flex items-center justify-center p-4">
                <h2
                  className="text-white font-bold text-xl sm:text-2xl text-center"
                  style={{ textShadow: '0 0 5px rgba(18,18,18,.5)' }}
                >
                  {cat.name}
                </h2>
              </div>
              <span className="absolute top-3 right-3 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-primary font-bold text-lg shadow opacity-0 group-hover:opacity-100 transition-opacity">
                →
              </span>
            </Link>
          ))}
        </div>
      )}

      {/* Sobre nosotros */}
      {(config.about_text || '').trim() && (
        <div className="mt-8 card p-6">
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-3">Sobre nosotros</h2>
          <p className="text-gray-600 whitespace-pre-line leading-relaxed">{config.about_text}</p>
        </div>
      )}

      {/* WhatsApp */}
      {config.whatsapp_number && (
        <div className="mt-8 card p-5 flex flex-col sm:flex-row items-center justify-between gap-4 bg-green-50 border-green-100">
          <div>
            <h3 className="font-bold text-gray-900">¿Preferís pedir por WhatsApp?</h3>
            <p className="text-sm text-gray-500">Mandanos tu pedido y te respondemos al toque</p>
          </div>
          <a
            href={`https://wa.me/${config.whatsapp_number.replace(/\D/g, '')}`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn bg-green-500 hover:bg-green-600 text-white shrink-0"
          >
            Pedir por WhatsApp 🟢
          </a>
        </div>
      )}
    </div>
  );
}
