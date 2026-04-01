#!/usr/bin/env python3
"""
Generate interview audio using ElevenLabs TTS API.
Produces one MP3 per segment, then concatenates into a single file.
"""

import os
import sys
import time
import struct
import requests

API_KEY = os.environ.get("ELVENLABS_API_KEY", "sk_b3fcac046c71f38721c178db33cb43ffec32dc8a97007e6a")
BASE_URL = "https://api.elevenlabs.io/v1"

VOICES = {
    "CAMILO": "9ZVfdvBemUaGEWZgCiv0",   # Mateo
    "RODRIGO": "6WgXEzo1HGn3i7ilT4Fh",  # Vicente
    "FELIPE": "ClNifCEVq1smkl4M3aTk",   # Cristian Cornejo
}

MODEL_ID = "eleven_multilingual_v2"

# Interview segments: (speaker, text)
SEGMENTS = [
    ("CAMILO", "Bueno, vamos a comenzar. Primero que nada, muchas gracias Rodrigo por darnos este espacio. Como te comentamos, estamos haciendo un levantamiento organizacional de Citolab para entender mejor cómo funciona cada área, documentar los procesos y detectar oportunidades de mejora. La idea es que esta conversación sea lo más natural posible, no hay respuestas correctas o incorrectas. ¿Te parece si partimos con una presentación tuya?"),

    ("RODRIGO", "Sí, claro, sin problema. Hola, mi nombre es Rodrigo Rojas Cevada, mi rut es 20 millones doscientos treinta y mil cuatrocientos setenta y dos y soy Tecnólogo Jefe de Histoquímica. Llevo trabajando en Citolab casi siete años, partí como tecnólogo de apoyo y fui asumiendo más responsabilidades hasta que me nombraron jefe del área hace tres años aproximadamente."),

    ("CAMILO", "Perfecto. ¿Nos podrías contar cuál es el propósito principal del área de Histoquímica dentro de Citolab?"),

    ("RODRIGO", "Sí, mira, Histoquímica es el área encargada de procesar las muestras de tejido que llegan al laboratorio. Básicamente lo que hacemos es recibir las biopsias y las piezas quirúrgicas que vienen desde los centros médicos, hospitales y clínicas, y las procesamos para que los patólogos puedan analizarlas al microscopio. Es un área crítica porque si nosotros no procesamos bien una muestra, el diagnóstico del paciente puede verse afectado. Trabajamos con tejidos de todo tipo: biopsias gástricas, de piel, de mama, piezas quirúrgicas grandes como úteros, vesículas, tiroides. Todo lo que tenga que ver con anatomía patológica pasa por nosotros."),

    ("FELIPE", "¿Y cuántas personas trabajan actualmente en tu equipo?"),

    ("RODRIGO", "Somos cinco personas en total. Estoy yo como jefe, y tengo cuatro tecnólogos médicos. Dos trabajan en el turno de mañana y dos en el turno de tarde. Yo cubro ambos turnos dependiendo de la carga de trabajo, pero normalmente estoy en la mañana. Además, tenemos un auxiliar de laboratorio que nos apoya con la recepción de muestras y el etiquetado, pero él depende administrativamente de otra área, del área de Recepción."),

    ("CAMILO", "Interesante. ¿Podrías describir el flujo completo de trabajo? Desde que llega una muestra hasta que sale de tu área."),

    ("RODRIGO", "Claro, el proceso es largo y tiene hartos pasos. Voy a tratar de ser bien detallado. Primero, las muestras llegan a Recepción. Ahí el personal de recepción las registra en el sistema, que es el LIS, el sistema de información del laboratorio. Le asignan un número de caso, verifican que la muestra venga correctamente identificada con los datos del paciente, y luego la trasladan a nuestra área. Cuando la muestra llega a Histoquímica, lo primero que hacemos es la macroscopía. Eso lo hace un tecnólogo o a veces el patólogo directamente si es una pieza compleja. La macroscopía consiste en examinar la muestra a simple vista, medir, describir y seleccionar los cortes que se van a procesar. Se toman los fragmentos de tejido y se ponen en unas cajitas que se llaman cassettes. Cada cassette se identifica con el número de caso y el número de bloque."),

    ("RODRIGO", "Después viene el procesamiento histológico propiamente tal, que es automatizado. Tenemos un procesador de tejidos, un equipo que funciona durante la noche. Lo cargamos al final del turno de tarde con todos los cassettes del día, y el equipo los pasa por una serie de baños de reactivos: formalina, alcoholes de distintas concentraciones, xilol y finalmente parafina. Ese proceso dura entre diez y doce horas. Al día siguiente en la mañana, los cassettes ya están impregnados en parafina. Luego viene la inclusión, que es cuando el tecnólogo toma cada cassette y lo incluye en un molde con parafina líquida para formar lo que llamamos un bloque de parafina. Eso se hace manualmente, uno por uno, y es un trabajo que requiere mucha precisión porque el tejido tiene que quedar bien orientado dentro del bloque."),

    ("RODRIGO", "Después de la inclusión viene el corte. Ahí usamos un micrótomo, que es un equipo que corta láminas súper delgadas del bloque de parafina, de entre tres y cinco micras de espesor. Cada lámina se monta en un portaobjeto de vidrio. Este paso es probablemente el más crítico y el que más depende de la habilidad del tecnólogo. Un mal corte significa que hay que repetir todo el proceso desde la inclusión. Una vez que tenemos los cortes montados en los portaobjetos, viene la tinción. La tinción estándar es Hematoxilina-Eosina, que le llamamos H y E. Es la tinción básica que permite ver las estructuras celulares. Pero también hacemos tinciones especiales según lo que pida el patólogo: PAS, tricrómico de Masson, Ziehl-Neelsen, Giemsa, entre otras. Finalmente, los portaobjetos teñidos se montan con un cubreobjetos y se entregan al área de Patología."),

    ("CAMILO", "Es un proceso bastante largo. ¿Cuántas muestras procesan al día en promedio?"),

    ("RODRIGO", "En un día normal procesamos entre ochenta y cien cassettes. Eso viene de aproximadamente cuarenta a sesenta casos distintos, porque cada caso puede tener uno o varios cassettes dependiendo del tipo de muestra. Una biopsia gástrica puede ser un solo cassette, pero una pieza quirúrgica de mama puede ser quince o veinte cassettes. En total, al mes estamos procesando alrededor de mil ochocientos a dos mil doscientos cassettes."),

    ("FELIPE", "¿Y eso se ha mantenido estable o ha ido creciendo?"),

    ("RODRIGO", "Ha crecido bastante. Cuando yo llegué hace siete años procesábamos como mil cassettes al mes. Hoy estamos en más del doble. El tema es que el equipo no ha crecido en la misma proporción. Antes éramos cuatro tecnólogos y hoy somos cinco, pero la carga se duplicó. Eso genera presión, sobre todo en los meses peak que son marzo, abril, mayo y septiembre, octubre, noviembre."),

    ("CAMILO", "Eso es un punto importante. ¿Cuáles dirías que son los principales problemas o cuellos de botella que enfrentan hoy?"),

    ("RODRIGO", "Hay varios. El primero y más crítico es el micrótomo. Tenemos dos micrótomos y uno está funcionando mal desde hace como cuatro meses. Se descalibra constantemente y los cortes salen irregulares. Hemos mandado a pedir el repuesto pero es importado y todavía no llega. Eso significa que estamos trabajando prácticamente con un solo micrótomo funcional, lo que genera un cuello de botella enorme en la etapa de corte."),

    ("RODRIGO", "El segundo problema es la falta de estandarización en la macroscopía. Cuando el patólogo hace la macroscopía, a veces describe las muestras de una forma y cuando la hace el tecnólogo, la describe de otra. No tenemos un protocolo unificado de descripción macroscópica."),

    ("RODRIGO", "El tercer problema es el sistema de información. El LIS que usamos es antiguo, tiene como quince años. No tiene módulo de trazabilidad de muestras. Usamos un cuaderno donde anotamos qué muestras entraron, en qué etapa están y cuándo salieron. Si alguien me pregunta dónde está una muestra específica, tengo que ir a buscar en el cuaderno o preguntarle a los tecnólogos."),

    ("FELIPE", "¿El cuaderno es físico? ¿Un cuaderno de papel?"),

    ("RODRIGO", "Sí, es un cuaderno de papel. Y además tenemos una planilla Excel donde vamos registrando los casos del día. Pero la planilla la llenamos al final del día, no en tiempo real. Entonces si a las once de la mañana un médico llama preguntando por su caso, tengo que ir a buscar físicamente la muestra. Es ineficiente y nos quita tiempo."),

    ("CAMILO", "¿Y el LIS no tiene ninguna forma de hacer ese seguimiento?"),

    ("RODRIGO", "No, el LIS solo registra el ingreso del caso y después el resultado cuando el patólogo hace el informe. Todo lo que pasa en el medio es una caja negra. Y eso es un problema no solo de eficiencia sino también de calidad, porque si hay un error en alguna etapa y no tenemos registro de quién hizo qué, es muy difícil hacer la trazabilidad."),

    ("CAMILO", "¿Qué otros problemas identificas?"),

    ("RODRIGO", "El cuarto problema es la dependencia de conocimiento en personas específicas. La tinción de inmunohistoquímica la maneja prácticamente solo la Claudia, que es una de las tecnólogas del turno de mañana. Si Claudia se enferma o está de vacaciones, las tinciones de inmuno se atrasan o simplemente no se hacen. Lo mismo con el procesador de tejidos, la programación la hago yo. Si yo falto, nadie más sabe cómo modificar los programas."),

    ("FELIPE", "¿No hay documentación de esos procedimientos?"),

    ("RODRIGO", "Hay algo, pero es muy básico. Tenemos un manual de procedimientos que se hizo hace como cinco años, pero no se ha actualizado. En la práctica, el conocimiento se transmite de persona a persona, de forma oral."),

    ("CAMILO", "¿Cómo se relaciona tu área con otras áreas de Citolab?"),

    ("RODRIGO", "Nos relacionamos principalmente con tres áreas. Recepción, de donde nos llegan las muestras. Patología, a donde van los portaobjetos. Y Administración, para compras de reactivos y mantenimiento. Con Administración es donde más fricción hay. El proceso de compra de reactivos es lento, pueden pasar tres a cuatro semanas desde que hago el requerimiento hasta que llega el reactivo."),

    ("FELIPE", "¿Tú manejas un stock mínimo?"),

    ("RODRIGO", "Sí, intento mantener un stock de seguridad de un mes, pero no siempre se puede. El consumo no es lineal y como no tenemos un sistema de control de inventario automatizado, a veces me doy cuenta tarde de que estamos quedando cortos. También lo manejo con planilla Excel."),

    ("CAMILO", "Hablemos de los equipos. ¿Qué equipos críticos tienen?"),

    ("RODRIGO", "Los equipos principales son cuatro. El procesador de tejidos Leica Peloris, los dos micrótomos Leica RM2255, la estación de inclusión, y el teñidor automático Leica ST5020. El mantenimiento lo coordino yo directamente con los proveedores, llevo el registro en otro Excel. Si yo me fuera de Citolab mañana, toda esa información se pierde."),

    ("CAMILO", "¿Qué indicadores usas para saber si tu área funciona bien?"),

    ("RODRIGO", "No tenemos indicadores formales. Mido informalmente el tiempo de respuesta. Nuestro estándar es cinco días hábiles para biopsias y siete para piezas quirúrgicas. Pero estamos demorando seis a siete días en biopsias y ocho a diez en piezas. También miro los reprocesos, estamos en un tres a cinco por ciento pero debería ser menos del dos."),

    ("FELIPE", "¿Esos datos los reportas a alguien?"),

    ("RODRIGO", "No de forma sistemática. No hay un reporte mensual. No nos da el tiempo, estamos enfocados en sacar el trabajo del día."),

    ("CAMILO", "¿Qué indicadores sería importante medir?"),

    ("RODRIGO", "Tiempo de respuesta por tipo de muestra, tasa de reprocesamiento, cassettes procesados por día por tecnólogo, consumo de reactivos versus producción, tiempo de inactividad de equipos, y muestras rechazadas por problemas de identificación."),

    ("CAMILO", "¿Qué tareas podrían automatizarse?"),

    ("RODRIGO", "La trazabilidad de muestras con códigos QR, el control de inventario automático, la generación de reportes, y la integración del procesador de tejidos con el sistema de información."),

    ("FELIPE", "¿Y en inteligencia artificial, ves algún uso?"),

    ("RODRIGO", "Sí, control de calidad de cortes con visión artificial, priorización automática de casos, y predicción de demanda."),

    ("CAMILO", "¿Qué funciona bien hoy?"),

    ("RODRIGO", "El equipo humano es excelente, el procesador Leica Peloris es confiable, la relación con los patólogos es buena, y tenemos buen clima laboral."),

    ("CAMILO", "¿Qué riesgos operativos identificas?"),

    ("RODRIGO", "La pérdida o confusión de una muestra, que tendría consecuencias gravísimas. La falla del procesador sin respaldo. Y la rotación de personal, porque capacitar a un tecnólogo nuevo toma al menos tres meses, y seis meses para que haga buenos cortes en el micrótomo."),

    ("CAMILO", "Si pudieras cambiar una sola cosa en los próximos seis meses, ¿qué sería?"),

    ("RODRIGO", "Sin duda el sistema de trazabilidad con código de barras o QR. Resolvería varios problemas de una vez: visibilidad, datos para indicadores, reducir riesgo de confusión, y dejar de depender del cuaderno y las planillas."),

    ("CAMILO", "Perfecto Rodrigo. Ha sido una entrevista muy completa. ¿Tienes alguna pregunta?"),

    ("RODRIGO", "Sí, me gustaría saber cuándo veríamos algún resultado concreto."),

    ("CAMILO", "Vamos a procesar esta entrevista con inteligencia artificial para extraer procesos, problemas y oportunidades. En cuatro a seis semanas tendríamos el primer diagnóstico para el directorio."),

    ("RODRIGO", "Me parece bien. Estoy disponible si necesitan profundizar."),

    ("FELIPE", "Me gustaría conversar con la Claudia para entender mejor el tema de la inmunohistoquímica."),

    ("RODRIGO", "Sin problema, le aviso."),

    ("CAMILO", "Muchas gracias Rodrigo, nos va a servir mucho."),

    ("RODRIGO", "Gracias a ustedes. Ojalá que esto se traduzca en mejoras reales para el laboratorio."),
]

OUTPUT_DIR = "/Users/camiloespinoza/Zeru/docs/research/audio-segments"
FINAL_OUTPUT = "/Users/camiloespinoza/Zeru/docs/research/entrevista-rodrigo-rojas.mp3"


def generate_segment(voice_id: str, text: str, output_path: str) -> bool:
    """Generate a single audio segment using ElevenLabs API."""
    url = f"{BASE_URL}/text-to-speech/{voice_id}"
    headers = {
        "xi-api-key": API_KEY,
        "Content-Type": "application/json",
        "Accept": "audio/mpeg",
    }
    data = {
        "text": text,
        "model_id": MODEL_ID,
        "voice_settings": {
            "stability": 0.5,
            "similarity_boost": 0.75,
            "style": 0.0,
            "use_speaker_boost": True,
        },
    }

    resp = requests.post(url, json=data, headers=headers, timeout=120)
    if resp.status_code != 200:
        print(f"  ERROR: {resp.status_code} - {resp.text[:200]}")
        return False

    with open(output_path, "wb") as f:
        f.write(resp.content)
    return True


def concatenate_mp3s(file_paths: list, output_path: str):
    """Simple MP3 concatenation (binary append — works for same-format MP3s)."""
    with open(output_path, "wb") as outfile:
        for fp in file_paths:
            with open(fp, "rb") as infile:
                outfile.write(infile.read())


def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    segment_files = []
    total = len(SEGMENTS)

    for i, (speaker, text) in enumerate(SEGMENTS):
        voice_id = VOICES[speaker]
        filename = f"{OUTPUT_DIR}/seg_{i:03d}_{speaker.lower()}.mp3"
        segment_files.append(filename)

        if os.path.exists(filename) and os.path.getsize(filename) > 1000:
            print(f"[{i+1}/{total}] SKIP (exists): {speaker} - {text[:50]}...")
            continue

        print(f"[{i+1}/{total}] Generating: {speaker} - {text[:50]}...")
        success = generate_segment(voice_id, text, filename)

        if not success:
            print(f"  FAILED segment {i}, retrying in 5s...")
            time.sleep(5)
            success = generate_segment(voice_id, text, filename)
            if not success:
                print(f"  FAILED again, skipping segment {i}")
                segment_files.remove(filename)

        # Rate limiting
        time.sleep(0.5)

    print(f"\nConcatenating {len(segment_files)} segments...")
    concatenate_mp3s(segment_files, FINAL_OUTPUT)

    size_mb = os.path.getsize(FINAL_OUTPUT) / (1024 * 1024)
    print(f"\nDone! Output: {FINAL_OUTPUT} ({size_mb:.1f} MB)")
    print(f"Segments: {len(segment_files)}/{total}")


if __name__ == "__main__":
    main()
