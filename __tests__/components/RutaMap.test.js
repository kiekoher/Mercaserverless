import { render, screen } from '@testing-library/react';

jest.mock('react-leaflet', () => {
  const React = require('react');
  return {
    MapContainer: ({ children }) => <div data-testid='map'>{children}</div>,
    TileLayer: () => <div data-testid='tile' />,
    Marker: ({ children }) => <div data-testid='marker'>{children}</div>,
    Popup: ({ children }) => <div data-testid='popup'>{children}</div>,
  };
});


const RutaMap = require('../../components/RutaMap').default;

describe('RutaMap', () => {
  it('renders markers and popups for valid points', () => {
    const puntos = [
      { id: '1', latitud: 10, longitud: 20, nombre: 'P1', direccion: 'Dir1' },
    ];
    render(<RutaMap puntos={puntos} />);
    expect(screen.getByTestId('map')).toBeInTheDocument();
    expect(screen.getAllByTestId('marker')).toHaveLength(1);
    expect(screen.getByText('P1')).toBeInTheDocument();
  });

  it('shows message when no points are provided', () => {
    render(<RutaMap puntos={[]} />);
    expect(
      screen.getByText(/No hay puntos con coordenadas/)
    ).toBeInTheDocument();
  });

  it('shows message when points have invalid coordinates', () => {
    const puntos = [
      { id: '1', nombre: 'P1', direccion: 'Dir1', latitud: null, longitud: null },
    ];
    render(<RutaMap puntos={puntos} />);
    expect(
      screen.getByText(/no tienen coordenadas válidas/i)
    ).toBeInTheDocument();
  });
});
