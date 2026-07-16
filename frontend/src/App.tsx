import MapContainer from './components/Map/MapContainer';

document.documentElement.classList.add('dark'); // 顺手为后面的深色主题埋下伏笔

export default function App() {
  return (
    <div className="app-container" style={{ width: '100vw', height: '100vh', overflow: 'hidden' }}>
      {/* 铺满全屏的地图底层 */}
      <MapContainer />
    </div>
  );
}