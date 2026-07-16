import { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

export default function MapContainer() {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);

  useEffect(() => {
    if (!mapContainerRef.current) return;

    // 初始化 MapLibre 地图
    mapRef.current = new maplibregl.Map({
      container: mapContainerRef.current,
      // 使用自带的开源底图样式（免 Key，人在欧洲直连速度极快）
      style: 'https://demotiles.maplibre.org/style.json', 
      center: [11.582, 48.135], // 默认定位在慕尼黑 (经度, 纬度)
      zoom: 12,
    });

    // 加上导航缩放控件
    mapRef.current.addControl(new maplibregl.NavigationControl(), 'top-right');

    // 组件卸载时销毁地图实例，防止内存泄漏
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
      }
    };
  }, []);

  return (
    <div 
      ref={mapContainerRef} 
      style={{ width: '100%', height: '100%', minHeight: '500px' }} 
    />
  );
}