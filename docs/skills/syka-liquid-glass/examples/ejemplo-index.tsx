/* Ejemplo de proyecto con Liquid Glass: una toma a cámara de 25,6 s con
 * titular, placa, cifra, frase y pasos. Copiá `liquid.tsx` a `liquid/` del
 * proyecto y adaptá este archivo: la toma, los tiempos y los textos salen del
 * transcript de la persona.
 */
import { VideoLiquid, frase, pasos, placa, stat, titular, validar } from "./liquid/liquid";

const TOMA = "01 Crudos/toma-camara.mp4";
const DURACION = 25.6;

const piezas = [
  titular({ id: "intro-titular", in: 0.4, out: 3.8, title: "A PRUEBA.", pill: "Uno o dos días" }),
  placa({ id: "intro-placa", in: 0.9, out: 3.9, name: "Nombre", sub: "Lo que hace" }),
  stat({
    id: "intro-cifra", in: 4.9, out: 9.0, label: "Prueba", value: "1–2", unit: "días", sub: "antes de usarlo a diario",
    fuente: "cámara 00:05 «uno o dos días»",
  }),
  frase({ id: "intro-frase", in: 9.7, out: 12.6, title: "Ahora estoy con mucho." }),
  pasos({
    id: "cuerpo-semana", in: 17.9, out: 24.6, title: "Esta semana",
    items: ["Entorno de agentes", "Proyecto en comunidad"], reveal: [18.6, 23.1],
  }),
];

// Caja de la cara medida en un frame de la toma: [x, y, ancho, alto].
validar(piezas, { duracion: DURACION, cara: [880, 330, 700, 750] });

export default function Project() {
  return (
    <stage background="#161616" camera={[0.3, 0, 0, 0.3, 85, 150]}>
      <scene id="main" name="Liquid Glass" width={1920} height={1080} fill="black" active>
        <VideoLiquid
          name="Toma a cámara"
          src={TOMA}
          start={0}
          end={DURACION}
          sourceIn={0}
          vidrios={piezas.flatMap((p) => p.vidrios)}
          zoom={[[0, 1], [12.7, 1], [14.5, 1.14], [16.6, 1.14], [17.8, 1]]}
        />
        {piezas.map((p) => p.contenido())}
      </scene>
    </stage>
  );
}
