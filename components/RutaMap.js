import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

// Fix for default icon issue with Webpack
delete L.Icon.Default.prototype._getIconUrl;

L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x.src || markerIcon2x,
  iconUrl: markerIcon.src || markerIcon,
  shadowUrl: markerShadow.src || markerShadow,
});

const RutaMap = ({ puntos, center }) => {
  if (!puntos || puntos.length === 0) {
    return <p>No hay puntos con coordenadas para mostrar en el mapa.</p>;
  }

  // Filter out points that don't have valid coordinates
  const validPuntos = puntos.filter(p => p.latitud != null && p.longitud != null);

  if (validPuntos.length === 0) {
    return <p>Los puntos de esta ruta no tienen coordenadas válidas.</p>;
  }

  const mapCenter = center || [validPuntos[0].latitud, validPuntos[0].longitud];

  return (
    <MapContainer center={mapCenter} zoom={13} style={{ height: '400px', width: '100%' }}>
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      />
      {validPuntos.map(punto => (
        <Marker key={punto.id} position={[punto.latitud, punto.longitud]}>
          <Popup>
            <strong>{punto.nombre}</strong><br />
            {punto.direccion}
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
};

export default RutaMap;
