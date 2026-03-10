import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface GuestEntry {
  name: string;
  position?: string | null;
  topic: string;
  phone?: string | null;
  recording_status: string;
  program_type?: string | null;
  day_of_week: string;
  time_slot: number;
  week_date: string;
}

const guests: GuestEntry[] = [
  // ============================================================
  // SEMANA 2026-01-12
  // ============================================================
  // Slot 1
  { name: "Sebastian Montoya", position: "piloto Formula 2", topic: "Piloto Formula 2", phone: "+17865542101", recording_status: "live", day_of_week: "monday", time_slot: 1, week_date: "2026-01-12" },
  { name: "Mauricio y Palodeagua", position: null, topic: "Lanzamiento \"Mariposas de Papel\"", phone: "+573103349149", recording_status: "live", day_of_week: "tuesday", time_slot: 1, week_date: "2026-01-12" },
  { name: "Laura Maré", position: "cantante, escritora", topic: "Instrucciones para vivir con el corazón roto", phone: "+573003788518", recording_status: "live", day_of_week: "wednesday", time_slot: 1, week_date: "2026-01-12" },
  { name: "Tavo Bernate", position: null, topic: "Comedia a domicilio", phone: "+573008688318", recording_status: "live", program_type: "Jueves de comedia a domicilio", day_of_week: "thursday", time_slot: 1, week_date: "2026-01-12" },
  // Slot 2
  { name: "Paola Pérez", position: "abogada", topic: "Mitos más comunes del derecho de familia", phone: "300 4359898", recording_status: "live", day_of_week: "monday", time_slot: 2, week_date: "2026-01-12" },
  { name: "Germán Puerta", position: "astrónomo", topic: "Eventos celestes y espaciales 2026", phone: "315 3473859", recording_status: "live", program_type: "Puerta al universo", day_of_week: "tuesday", time_slot: 2, week_date: "2026-01-12" },
  { name: "Maira Pérez", position: "experta en marketing digital y publicidad", topic: "Cómo lograr los propósitos este año", phone: "310 2912717", recording_status: "live", program_type: "Miércoles de Tutoriales radiales", day_of_week: "wednesday", time_slot: 2, week_date: "2026-01-12" },
  { name: "Carlos Sarria", position: "director de Poli Radio", topic: "Canciones que cumplen 30 años", phone: "313 4411385", recording_status: "live", program_type: "Jueves de #tbt", day_of_week: "thursday", time_slot: 2, week_date: "2026-01-12" },
  // Slot 3
  { name: "Valeria Charris", position: "Ex reina Carnaval de Barranquilla", topic: "Lanzamiento libro \"Vale (cumplir 30) Soñar\"", phone: "+573135020690", recording_status: "live", day_of_week: "monday", time_slot: 3, week_date: "2026-01-12" },
  { name: "Nicolás Romero", position: "Especialista en bienestar integral y nutrición", topic: "¿Por qué las dietas no funcionan?", phone: "3226842391", recording_status: "live", day_of_week: "tuesday", time_slot: 3, week_date: "2026-01-12" },
  { name: "Viviana Patricia Puentes", position: "Escritora", topic: "Libro \"Ela y el Olvido\" en Amazon", phone: "+573166535905", recording_status: "live", day_of_week: "wednesday", time_slot: 3, week_date: "2026-01-12" },
  { name: "Carlos Sarria", position: "director de Poli Radio", topic: "Canciones que cumplen 30 años", phone: "313 4411385", recording_status: "live", program_type: "Jueves de #tbt", day_of_week: "thursday", time_slot: 3, week_date: "2026-01-12" },

  // ============================================================
  // SEMANA 2026-01-19
  // ============================================================
  // Slot 1
  { name: "Heredero", position: null, topic: "Lanzamiento canción \"LINDA\"", phone: "+573107550294", recording_status: "live", day_of_week: "monday", time_slot: 1, week_date: "2026-01-19" },
  { name: "José Restrepo", position: null, topic: "Serie Estado de Fuga 1986", phone: "+573102429975", recording_status: "live", day_of_week: "tuesday", time_slot: 1, week_date: "2026-01-19" },
  { name: "Pescao Vivo (Giovanny Olaya)", position: null, topic: "Lanzamiento canción: \"Ilumíname\"", phone: "+573102066854", recording_status: "live", day_of_week: "wednesday", time_slot: 1, week_date: "2026-01-19" },
  { name: "Hefexto", position: null, topic: "No vuelvo a hacer el amor en el sleeping de mi hermanastra menor", phone: "+573007567086", recording_status: "live", program_type: "Jueves de comedia a domicilio", day_of_week: "thursday", time_slot: 1, week_date: "2026-01-19" },
  // Slot 2
  { name: "María Mercedes Cruz", position: null, topic: "Sin graduarse del colegio, logró ser una exitosa empresaria", phone: "+573043886168", recording_status: "live", program_type: "Lunes de historias que merecen ser contadas", day_of_week: "monday", time_slot: 2, week_date: "2026-01-19" },
  { name: "Germán Puerta", position: "astrónomo", topic: "Estación Espacial Internacional", phone: "315 3473859", recording_status: "live", program_type: "Puerta al universo", day_of_week: "tuesday", time_slot: 2, week_date: "2026-01-19" },
  { name: "Luis Victoria", position: "abogado de migración", topic: "Migración hacia Estados Unidos", phone: "+13056007560", recording_status: "live", program_type: "Miércoles de Tutoriales radiales", day_of_week: "wednesday", time_slot: 2, week_date: "2026-01-19" },
  { name: "Roberto Blanco", position: "D.J. La Kalle", topic: "Eventos y Conciertos 2026", phone: "+573143923498", recording_status: "live", program_type: "Jueves de #tbt", day_of_week: "thursday", time_slot: 2, week_date: "2026-01-19" },
  // Slot 3
  { name: "Melissa Láhur", position: null, topic: "Nuevo sencillo \"Hello Latinas\"", phone: "+573164642339", recording_status: "live", day_of_week: "monday", time_slot: 3, week_date: "2026-01-19" },
  { name: "María Esther Panesso", position: "Pintora", topic: "Expuso en el Salón de Otoño de París", phone: "+573102953575", recording_status: "live", day_of_week: "tuesday", time_slot: 3, week_date: "2026-01-19" },
  { name: "Carmen Velasco Linares", position: "Escritora", topic: "Libro \"Crónica de un secuestro\"", phone: "+573214822344", recording_status: "live", day_of_week: "wednesday", time_slot: 3, week_date: "2026-01-19" },
  { name: "Roberto Blanco", position: "D.J. La Kalle", topic: "Eventos y Conciertos 2026", phone: "+573143923498", recording_status: "live", program_type: "Jueves de #tbt", day_of_week: "thursday", time_slot: 3, week_date: "2026-01-19" },

  // ============================================================
  // SEMANA 2026-01-26
  // ============================================================
  // Slot 1
  { name: "Rafa Taibo", position: "locutor, actor y narrador", topic: "Show \"En el nombre del miedo\"", phone: "+573108045657", recording_status: "live", day_of_week: "monday", time_slot: 1, week_date: "2026-01-26" },
  { name: "María Eugenia Penagos", position: "actriz", topic: "Festival de teatro en Teusaquillo (Febrero)", phone: "+573108045657", recording_status: "live", day_of_week: "tuesday", time_slot: 1, week_date: "2026-01-26" },
  { name: "Danny Marín", position: "cantante", topic: "Lanzamiento Canción \"Alguien me gusta\"", phone: "+573214680386", recording_status: "live", day_of_week: "wednesday", time_slot: 1, week_date: "2026-01-26" },
  { name: "Carlos Mario Gallego", position: "comediante (Tola y Maruja)", topic: "Tola y Maruja hablan de aquello", phone: "+573005716162", recording_status: "live", program_type: "Jueves de comedia a domicilio", day_of_week: "thursday", time_slot: 1, week_date: "2026-01-26" },
  // Slot 2
  { name: "Ricardo González", position: "analista político", topic: "Elecciones 2026", phone: "+573002407669", recording_status: "live", program_type: "Lunes de historias que merecen ser contadas", day_of_week: "monday", time_slot: 2, week_date: "2026-01-26" },
  { name: "Germán Puerta", position: "astrónomo", topic: "Estación Espacial Internacional, segunda parte", phone: "315 3473859", recording_status: "live", program_type: "Puerta al universo", day_of_week: "tuesday", time_slot: 2, week_date: "2026-01-26" },
  { name: "Mariajosé Satizábal", position: "consultora", topic: "Hackea tu mente con tu ropa", phone: "+525548001131", recording_status: "live", program_type: "Miércoles de Tutoriales radiales", day_of_week: "wednesday", time_slot: 2, week_date: "2026-01-26" },
  { name: "Doble U Bernal", position: "jefe de operaciones de BLU Radio y amante del cine", topic: "Películas que cumplen 20 años", phone: null, recording_status: "live", program_type: "Jueves de #tbt", day_of_week: "thursday", time_slot: 2, week_date: "2026-01-26" },
  // Slot 3
  { name: "Andrés Mahecha", position: "Ex Task Force Officer", topic: "Libro \"Narco Ranger\"", phone: "+19545364352", recording_status: "live", day_of_week: "monday", time_slot: 3, week_date: "2026-01-26" },
  { name: "La Pambelé", position: "agrupación folclórica", topic: "Concierto en HAY Festival Cartagena", phone: "+573204983177", recording_status: "live", day_of_week: "tuesday", time_slot: 3, week_date: "2026-01-26" },
  { name: "Leonardo Bello", position: "médico neurólogo funcional", topic: "Libro \"Para que no se te olvide\"", phone: "+573009983762", recording_status: "live", day_of_week: "wednesday", time_slot: 3, week_date: "2026-01-26" },
  { name: "Lu Beccassino", position: "psicóloga y escritora", topic: "Libro \"Si nos enseñaran a amar\"", phone: "+573128859045", recording_status: "live", day_of_week: "thursday", time_slot: 3, week_date: "2026-01-26" },

  // ============================================================
  // SEMANA 2026-02-02
  // ============================================================
  // Slot 1
  { name: "Walther Luengas", position: "actor", topic: "Obra \"Más que amigos\"", phone: "+573208846136", recording_status: "live", day_of_week: "monday", time_slot: 1, week_date: "2026-02-02" },
  { name: "Michell Orozco", position: "actriz", topic: "\"Soraya Giraldo\" en La Reina del Flow", phone: "+573108045657", recording_status: "live", day_of_week: "tuesday", time_slot: 1, week_date: "2026-02-02" },
  { name: "Luis Alfonso", position: null, topic: "Lanzamiento de nuevo trabajo discográfico", phone: "+573113087809", recording_status: "live", day_of_week: "wednesday", time_slot: 1, week_date: "2026-02-02" },
  { name: "Carolina Navas", position: "comediante", topic: "Oigan a mi tía Resentilia", phone: "+573114819631", recording_status: "live", program_type: "Jueves de comedia a domicilio", day_of_week: "thursday", time_slot: 1, week_date: "2026-02-02" },
  // Slot 2
  { name: "María Mónica Gutiérrez", position: null, topic: "Músico que ayuda a niños colombianos en Londres a conectar a través de la música", phone: "+573002080807", recording_status: "live", program_type: "Historias que merecen ser contadas", day_of_week: "monday", time_slot: 2, week_date: "2026-02-02" },
  { name: "Germán Puerta", position: "astrónomo", topic: "Psicología del espacio", phone: "315 3473859", recording_status: "live", program_type: "Puerta al universo", day_of_week: "tuesday", time_slot: 2, week_date: "2026-02-02" },
  { name: "David Pereira", position: "Ciberseguridad", topic: "Aprenda a que NO lo hackeen", phone: "+573002002972", recording_status: "live", program_type: "Miércoles de Tutoriales radiales", day_of_week: "wednesday", time_slot: 2, week_date: "2026-02-02" },
  { name: "Carlos Sarria", position: "director de Poli Radio", topic: "Música para hacer el amor", phone: "313 4411385", recording_status: "live", program_type: "Jueves de #tbt", day_of_week: "thursday", time_slot: 2, week_date: "2026-02-02" },
  // Slot 3
  { name: "Helman", position: "Cantante", topic: "Lanzamiento \"Mi ángel de cuatro patas\"", phone: "+573208728554", recording_status: "live", day_of_week: "monday", time_slot: 3, week_date: "2026-02-02" },
  { name: "Antonia Jones", position: "Cantante", topic: "Lanzamiento canción \"Besos Rotos\"", phone: "+573123875131", recording_status: "live", day_of_week: "tuesday", time_slot: 3, week_date: "2026-02-02" },
  { name: "Ariel Merchán", position: "Director", topic: "Obra de teatro \"Después\"", phone: "+573172995255", recording_status: "live", day_of_week: "wednesday", time_slot: 3, week_date: "2026-02-02" },
  { name: "Carlos Sarria", position: "director de Poli Radio", topic: "Música para hacer el amor", phone: "313 4411385", recording_status: "live", program_type: "Jueves de #tbt", day_of_week: "thursday", time_slot: 3, week_date: "2026-02-02" },

  // ============================================================
  // SEMANA 2026-02-09
  // ============================================================
  // Slot 1
  { name: "Flora Martínez", position: "actriz y directora", topic: "Película \"Basta Mamá\"", phone: "+573102931076", recording_status: "live", day_of_week: "monday", time_slot: 1, week_date: "2026-02-09" },
  { name: "Marcela Valencia", position: "actriz", topic: "Obra \"Mantener el juicio\"", phone: "+573204243256", recording_status: "live", day_of_week: "tuesday", time_slot: 1, week_date: "2026-02-09" },
  { name: "Galy Galiano", position: "cantante", topic: "Tour de despedida \"La última y nos vamos\"", phone: "+573118138124", recording_status: "live", day_of_week: "wednesday", time_slot: 1, week_date: "2026-02-09" },
  { name: "Ángela Ñungo y Hernán Córdoba", position: "comediantes", topic: "Planchando tusas, comedia y karaoke", phone: "3008547505 / 3175746207", recording_status: "live", program_type: "Jueves de comedia a domicilio", day_of_week: "thursday", time_slot: 1, week_date: "2026-02-09" },
  // Slot 2
  { name: "Ernesto Gutiérrez", position: "Head of Partner AI de Google", topic: "Cómo logré trabajar en Google", phone: "+5215549406498", recording_status: "live", day_of_week: "monday", time_slot: 2, week_date: "2026-02-09" },
  { name: "Germán Puerta", position: "astrónomo", topic: "Apolo 8 vs Artemisa 2", phone: "315 3473859", recording_status: "live", program_type: "Puerta al universo", day_of_week: "tuesday", time_slot: 2, week_date: "2026-02-09" },
  { name: "Daniela Hoyos", position: "Comunicadora social y docente universitaria", topic: "Autoestima vs. éxito", phone: "+573184339640", recording_status: "live", day_of_week: "wednesday", time_slot: 2, week_date: "2026-02-09" },
  { name: "Sigifredo Turga", position: null, topic: "Tite Curet Alonso", phone: "300 2046535", recording_status: "live", program_type: "Jueves de #tbt", day_of_week: "thursday", time_slot: 2, week_date: "2026-02-09" },
  // Slot 3
  { name: "Diamante Eléctrico", position: null, topic: "Lanzamiento Canción \"Oro\"", phone: "+573138517158", recording_status: "live", day_of_week: "monday", time_slot: 3, week_date: "2026-02-09" },
  { name: "David Susa", position: "experto en finanzas (Cofundador mejorCDT)", topic: "Invertir sin filas y trámites físicos", phone: "+573112374021", recording_status: "live", day_of_week: "tuesday", time_slot: 3, week_date: "2026-02-09" },
  { name: "Zelaya", position: "Cantante guatemalteca", topic: "Lanzamiento \"No Me Llores\" Feat Gusi", phone: "+573175103270", recording_status: "live", day_of_week: "wednesday", time_slot: 3, week_date: "2026-02-09" },
  { name: "Sigifredo Turga", position: null, topic: "Tite Curet Alonso", phone: "300 2046535", recording_status: "live", program_type: "Jueves de #tbt", day_of_week: "thursday", time_slot: 3, week_date: "2026-02-09" },

  // ============================================================
  // SEMANA 2026-02-16
  // ============================================================
  // Slot 1
  { name: "Alisson Joan", position: "Actriz", topic: "\"Yara Giraldo (Sky)\" en La Reina del Flow", phone: "+573118138124", recording_status: "live", day_of_week: "monday", time_slot: 1, week_date: "2026-02-16" },
  { name: "Jerau", position: "cantante", topic: "Lanzamiento videoclip \"Cupido\"", phone: "+573135321805", recording_status: "live", day_of_week: "tuesday", time_slot: 1, week_date: "2026-02-16" },
  { name: "Raquel Sofía Amaya", position: "actriz", topic: "Obra de teatro \"Las Ochenteras\"", phone: "+573114824073", recording_status: "live", day_of_week: "wednesday", time_slot: 1, week_date: "2026-02-16" },
  { name: "Nana Sanabria", position: null, topic: "Comedia a domicilio", phone: "+573133129793", recording_status: "live", program_type: "Jueves de comedia a domicilio", day_of_week: "thursday", time_slot: 1, week_date: "2026-02-16" },
  // Slot 2
  { name: "Nicolás Carvajal", position: null, topic: "Remó más de 5.000 Kms solo, atravesó el Atlántico", phone: "+573223515994", recording_status: "live", program_type: "Lunes de historias que merecen ser contadas", day_of_week: "monday", time_slot: 2, week_date: "2026-02-16" },
  { name: "Germán Puerta", position: "astrónomo", topic: "Los agujeros negros", phone: "315 3473859", recording_status: "live", program_type: "Puerta al universo", day_of_week: "tuesday", time_slot: 2, week_date: "2026-02-16" },
  { name: "Sergio Beltrán (Gio)", position: "Coach de personalidad", topic: "Cómo seducir sin fallar en el intento", phone: "+573195194055", recording_status: "live", day_of_week: "wednesday", time_slot: 2, week_date: "2026-02-16" },
  { name: "Sergio Borja", position: "libretista y asesor de contenidos", topic: "Visitas insoportables", phone: "314 2395397", recording_status: "live", program_type: "Jueves de #tbt", day_of_week: "thursday", time_slot: 2, week_date: "2026-02-16" },
  // Slot 3
  { name: "Juan Morales / María Fernanda Hernández", position: "Actor / Líder Barra Pato Pekín", topic: "Monólogo \"A la deriva\" / Año nuevo chino", phone: "+573164798587 / +573226842391", recording_status: "live", day_of_week: "monday", time_slot: 3, week_date: "2026-02-16" },
  { name: "Alex Sam", position: "Cantante", topic: "Lanzamiento \"El trago de olvidar\"", phone: "+573203721710", recording_status: "live", day_of_week: "tuesday", time_slot: 3, week_date: "2026-02-16" },
  { name: "Juanita Balaguera / María Paula Ramírez", position: "cantante / librera", topic: "Canción Estúpido / Librería Palabrero", phone: null, recording_status: "live", day_of_week: "wednesday", time_slot: 3, week_date: "2026-02-16" },
  { name: "Sergio Borja", position: "libretista y asesor de contenidos", topic: "Visitas insoportables", phone: "314 2395397", recording_status: "live", program_type: "Jueves de #tbt", day_of_week: "thursday", time_slot: 3, week_date: "2026-02-16" },

  // ============================================================
  // SEMANA 2026-02-23
  // ============================================================
  // Slot 1
  { name: "Natalia Bedoya", position: "cantante", topic: "Concierto \"Romance\"", phone: "+573176201555", recording_status: "live", day_of_week: "monday", time_slot: 1, week_date: "2026-02-23" },
  { name: "Willie González", position: "cantante", topic: "Trayectoria Vol. 3 \"Paso la vida pensando\"", phone: "+573103100089", recording_status: "live", day_of_week: "tuesday", time_slot: 1, week_date: "2026-02-23" },
  { name: "Dinkol Arroyo", position: "cantante", topic: "Arroyo Sinfónico (18 Abril)", phone: "+573213945709", recording_status: "live", day_of_week: "wednesday", time_slot: 1, week_date: "2026-02-23" },
  { name: "José Ordóñez", position: "humorista", topic: "Show Emparejados (28 feb)", phone: "+573213024385", recording_status: "live", day_of_week: "thursday", time_slot: 1, week_date: "2026-02-23" },
  // Slot 2
  { name: "Kelly Torres", position: "investigadora y periodista de misterio", topic: "La reina vudú de Nueva Orleans", phone: "310 7031045", recording_status: "live", day_of_week: "monday", time_slot: 2, week_date: "2026-02-23" },
  { name: "Germán Puerta", position: "astrónomo", topic: "El final del universo", phone: "315 3473859", recording_status: "live", program_type: "Puerta al universo", day_of_week: "tuesday", time_slot: 2, week_date: "2026-02-23" },
  { name: "Paola Pérez", position: "abogada", topic: "Leyes sobre el ruido en vivienda y propiedad horizontal", phone: "300 4359898", recording_status: "live", day_of_week: "wednesday", time_slot: 2, week_date: "2026-02-23" },
  { name: "Diego Chacón", position: "D.J. de bodas", topic: "Canciones que no pueden faltar en un matrimonio", phone: "+573106995679", recording_status: "live", day_of_week: "thursday", time_slot: 2, week_date: "2026-02-23" },
  // Slot 3
  { name: "Brina Quoya", position: "Músico", topic: "Lanzamiento canción \"Mi nombre en tu boca\"", phone: "+573116854042", recording_status: "live", day_of_week: "monday", time_slot: 3, week_date: "2026-02-23" },
  { name: "Alejandro Verswyvel Gutiérrez", position: "Experto en finanzas", topic: "Cinco claves para empezar el año con orden y liquidez", phone: "+573183741803", recording_status: "live", day_of_week: "tuesday", time_slot: 3, week_date: "2026-02-23" },
  { name: "Luisa Martínez", position: "Actriz", topic: "Obra de teatro \"Soledades con M de Marzo\"", phone: "+573204243256", recording_status: "live", day_of_week: "wednesday", time_slot: 3, week_date: "2026-02-23" },
  { name: "Diego Chacón", position: "D.J. de bodas", topic: "Canciones que no pueden faltar en un matrimonio", phone: "+573106995679", recording_status: "live", day_of_week: "thursday", time_slot: 3, week_date: "2026-02-23" },

  // ============================================================
  // SEMANA 2026-03-02
  // ============================================================
  // Slot 1
  { name: "Nino Segarra", position: "cantante", topic: "Canción \"Vivir sin ti\"", phone: "+573103100089", recording_status: "live", day_of_week: "monday", time_slot: 1, week_date: "2026-03-02" },
  { name: "Yesenia Valencia", position: null, topic: "Lanzamiento Smartfilms", phone: "+573114824073", recording_status: "live", day_of_week: "tuesday", time_slot: 1, week_date: "2026-03-02" },
  { name: "Kike Santander", position: "compositor", topic: "A Otro Nivel", phone: "+13053325655", recording_status: "live", day_of_week: "wednesday", time_slot: 1, week_date: "2026-03-02" },
  { name: "Hernán Córdoba", position: "comediante", topic: "Generación de cristal", phone: "+573175746207", recording_status: "live", program_type: "Jueves de comedia a domicilio", day_of_week: "thursday", time_slot: 1, week_date: "2026-03-02" },
  // Slot 2
  { name: "Juan Pablo López", position: "Emprendedor", topic: "De empleado a emprendedor", phone: "+573222139134", recording_status: "live", day_of_week: "monday", time_slot: 2, week_date: "2026-03-02" },
  { name: "Germán Puerta", position: "astrónomo", topic: "El cielo de marzo", phone: "315 3473859", recording_status: "live", program_type: "Puerta al universo", day_of_week: "tuesday", time_slot: 2, week_date: "2026-03-02" },
  { name: "Maira Pérez", position: "experta en marketing digital y publicidad", topic: "¿Cuál es mi habilidad en ventas?", phone: "310 2912717", recording_status: "live", program_type: "Miércoles de Tutoriales radiales", day_of_week: "wednesday", time_slot: 2, week_date: "2026-03-02" },
  { name: "Eduardo Molano", position: null, topic: "Canciones con nombre de mujer", phone: "+573103446519", recording_status: "live", program_type: "Jueves de #tbt", day_of_week: "thursday", time_slot: 2, week_date: "2026-03-02" },
  // Slot 3
  { name: "Marlon DJ", position: "Productor", topic: "Lanzamiento \"Globalizado\" (con Amilcar Boscan)", phone: "+57 310 3100089", recording_status: "live", day_of_week: "monday", time_slot: 3, week_date: "2026-03-02" },
  { name: "Sofía Zapata", position: "Escritora (estudiante)", topic: "Libro \"La vida es fascinante, solo hay que verla con las gafas correctas\"", phone: "573003033265", recording_status: "live", day_of_week: "tuesday", time_slot: 3, week_date: "2026-03-02" },
  { name: "Duplat", position: "Cantante", topic: "Canción \"Dulce y Amarga\" Colaboración con Andrés Cepeda", phone: "+573017808004", recording_status: "live", day_of_week: "wednesday", time_slot: 3, week_date: "2026-03-02" },
  { name: "Eduardo Molano", position: null, topic: "Canciones con nombre de mujer", phone: "+573103446519", recording_status: "live", program_type: "Jueves de #tbt", day_of_week: "thursday", time_slot: 3, week_date: "2026-03-02" },

  // ============================================================
  // SEMANA 2026-03-09
  // ============================================================
  // Slot 1
  { name: "Gian Marco", position: "cantante", topic: "A Otro Nivel", phone: "+573108139978", recording_status: "live", day_of_week: "monday", time_slot: 1, week_date: "2026-03-09" },
  { name: "Jhon Alex Toro", position: "actor", topic: "\"El coronel no tiene quién le escriba\" en ALUNA", phone: "+573175127482", recording_status: "live", day_of_week: "tuesday", time_slot: 1, week_date: "2026-03-09" },
  { name: "Alkilados (Juan Gálvez)", position: "agrupación musical", topic: "Reescriben \"Indeleble\" con Sebastián Yepes", phone: "+573138517158", recording_status: "live", day_of_week: "wednesday", time_slot: 1, week_date: "2026-03-09" },
  { name: "Óscar Iván Castaño", position: "Humorista e imitador", topic: "Imitarte es mi arte", phone: "3133953164", recording_status: "live", program_type: "Jueves de comedia a domicilio", day_of_week: "thursday", time_slot: 1, week_date: "2026-03-09" },
  // Slot 2
  { name: "Ricardo González", position: "analista político", topic: "Elecciones 2026", phone: "+573002407669", recording_status: "live", program_type: "Lunes de historias que merecen ser contadas", day_of_week: "monday", time_slot: 2, week_date: "2026-03-09" },
  { name: "Germán Puerta", position: "astrónomo", topic: "Historias de la astronomía en China", phone: "315 3473859", recording_status: "live", program_type: "Puerta al universo", day_of_week: "tuesday", time_slot: 2, week_date: "2026-03-09" },
  { name: "Catalina Cuéllar", position: "emprendedora", topic: "Cómo monetizar tu conocimiento", phone: "+573176989507", recording_status: "live", day_of_week: "wednesday", time_slot: 2, week_date: "2026-03-09" },
  { name: "Carlos Sarria", position: "director de Poli Radio", topic: "Música para hacer asados", phone: "313 4411385", recording_status: "live", program_type: "Jueves de #tbt", day_of_week: "thursday", time_slot: 2, week_date: "2026-03-09" },
  // Slot 3
  { name: "De Mar y Rico", position: "agrupación musical (Felipe Amu, director musical)", topic: "Lanzamiento canción \"Irene\"", phone: "+573103531053", recording_status: "live", day_of_week: "monday", time_slot: 3, week_date: "2026-03-09" },
  { name: "Juan Arredondo", position: "fotoperiodista", topic: "Nominado al Óscar documental \"Armed Only With a Camera\"", phone: "+13475731774", recording_status: "live", day_of_week: "tuesday", time_slot: 3, week_date: "2026-03-09" },
  { name: "Rakel", position: null, topic: "Canción \"Volver a mí\"", phone: "+573116854042", recording_status: "live", day_of_week: "wednesday", time_slot: 3, week_date: "2026-03-09" },
  { name: "Carlos Sarria", position: "director de Poli Radio", topic: "Música para hacer asados", phone: "313 4411385", recording_status: "live", program_type: "Jueves de #tbt", day_of_week: "thursday", time_slot: 3, week_date: "2026-03-09" },

  // ============================================================
  // SEMANA 2026-03-16
  // ============================================================
  // Slot 1
  { name: "Carlos Torres", position: "actor La Reina del Flow 3", topic: "Lanzamiento bebida DIFY", phone: "+573507031974", recording_status: "live", day_of_week: "monday", time_slot: 1, week_date: "2026-03-16" },
  { name: "Jennifer Arenas", position: "actriz", topic: "Funciones \"El gran cine femenino\" (Película \"Legal\")", phone: "+573102931076", recording_status: "live", day_of_week: "tuesday", time_slot: 1, week_date: "2026-03-16" },
  { name: "Rey Guerrero", position: "chef", topic: "Ganó \"Óscar de la gastronomía internacional\"", phone: "+573102692874", recording_status: "live", day_of_week: "wednesday", time_slot: 1, week_date: "2026-03-16" },
  { name: "Lina Adarme", position: "comediante", topic: "Señora comprobada", phone: "304 6468234", recording_status: "live", program_type: "Jueves de comedia a domicilio", day_of_week: "thursday", time_slot: 1, week_date: "2026-03-16" },
  // Slot 2
  { name: "Christian Argüello Gómez", position: "escritor", topic: "La muerte no existe", phone: "314 5976531", recording_status: "live", day_of_week: "monday", time_slot: 2, week_date: "2026-03-16" },
  { name: "Germán Puerta", position: "astrónomo", topic: "Relatos de estrellas, parte 1", phone: "315 3473859", recording_status: "live", program_type: "Puerta al universo", day_of_week: "tuesday", time_slot: 2, week_date: "2026-03-16" },
  { name: "Sylvia Ramírez", position: "coach", topic: "Cómo detectar los puntos ciegos que bloquean el éxito", phone: "+573012302178", recording_status: "live", day_of_week: "wednesday", time_slot: 2, week_date: "2026-03-16" },
  { name: "Sigifredo Turga", position: null, topic: "Éxitos en vivo", phone: "300 2046535", recording_status: "live", program_type: "Jueves de #tbt", day_of_week: "thursday", time_slot: 2, week_date: "2026-03-16" },
  // Slot 3
  { name: "Simón Elias", position: "director", topic: "Lanzamiento \"Corozo\" (película colombiana)", phone: "+573116854042", recording_status: "live", day_of_week: "monday", time_slot: 3, week_date: "2026-03-16" },
  { name: "Angelo", position: "animador de Rick & Morty", topic: "Lupicon (22 marzo)", phone: "+573213945709", recording_status: "live", day_of_week: "tuesday", time_slot: 3, week_date: "2026-03-16" },
  { name: "Hazel B", position: "cantante", topic: "Canción \"Vivir sin ti\" Feat Nino Segarra", phone: "+573103100089", recording_status: "live", day_of_week: "wednesday", time_slot: 3, week_date: "2026-03-16" },
  { name: "Sigifredo Turga", position: null, topic: "Éxitos en vivo", phone: "300 2046535", recording_status: "live", program_type: "Jueves de #tbt", day_of_week: "thursday", time_slot: 3, week_date: "2026-03-16" },

  // ============================================================
  // SEMANA 2026-03-23
  // ============================================================
  // Slot 1
  { name: "Edward Porras", position: "periodista", topic: "Ojo de la noche", phone: "+573186960455", recording_status: "live", day_of_week: "monday", time_slot: 1, week_date: "2026-03-23" },
  { name: "Andrea Guzmán", position: "actriz", topic: "\"Manual para ninjas\" en DITU", phone: "+573106983993", recording_status: "live", day_of_week: "tuesday", time_slot: 1, week_date: "2026-03-23" },
  { name: "Peter Manjarrés", position: "cantante", topic: "A Otro Nivel", phone: "+573114533081", recording_status: "live", day_of_week: "wednesday", time_slot: 1, week_date: "2026-03-23" },
  { name: "Juan Buenavantura", position: null, topic: "El minuto de Juan", phone: "321 4546556", recording_status: "live", program_type: "Jueves de comedia a domicilio", day_of_week: "thursday", time_slot: 1, week_date: "2026-03-23" },
  // Slot 2
  { name: "Tatiana Barreto", position: "(@RolaenMadrid) conferencista", topic: "Convirtió la nostalgia migrante en un movimiento de unión y esperanza", phone: "+573176201555", recording_status: "live", day_of_week: "monday", time_slot: 2, week_date: "2026-03-23" },
  { name: "Germán Puerta", position: "astrónomo", topic: "Relatos de estrellas, parte 2", phone: "315 3473859", recording_status: "live", program_type: "Puerta al universo", day_of_week: "tuesday", time_slot: 2, week_date: "2026-03-23" },
  { name: "Johana Riaño", position: null, topic: "Cuando el ruido apaga la inspiración", phone: "+573004959605", recording_status: "live", program_type: "Miércoles de Tutoriales radiales", day_of_week: "wednesday", time_slot: 2, week_date: "2026-03-23" },
  { name: "Sergio Borja", position: "libretista y asesor de contenidos", topic: "Dichos", phone: "314 2395397", recording_status: "live", program_type: "Jueves de #tbt", day_of_week: "thursday", time_slot: 2, week_date: "2026-03-23" },
  // Slot 3
  { name: "Juan Pablo Vega", position: "Cantante", topic: "Disco \"Cachacoleto\" y conciertos 24 y 25 abril", phone: null, recording_status: "live", day_of_week: "wednesday", time_slot: 3, week_date: "2026-03-23" },
  { name: "Sergio Borja", position: "libretista y asesor de contenidos", topic: "Dichos", phone: "314 2395397", recording_status: "live", program_type: "Jueves de #tbt", day_of_week: "thursday", time_slot: 3, week_date: "2026-03-23" },

  // ============================================================
  // SEMANA 2026-03-30 (TODO GRABADO)
  // ============================================================
  // Slot 1
  { name: "Los Chiches Vallenatos (Neder)", position: null, topic: "Lanzamiento \"Y quédate\"", phone: "+573128328390", recording_status: "live", day_of_week: "monday", time_slot: 1, week_date: "2026-03-30" },
  { name: "Juan Carlos Yela", position: "actor", topic: "\"Manual para ninjas\" en DITU", phone: "+573108045657", recording_status: "live", day_of_week: "tuesday", time_slot: 1, week_date: "2026-03-30" },
  // Slot 2
  { name: "Kelly Torres", position: "investigadora y periodista de misterio", topic: "El demonio de la Catedral azteca", phone: "310 7031045", recording_status: "live", day_of_week: "monday", time_slot: 2, week_date: "2026-03-30" },
  { name: "Germán Puerta", position: "astrónomo", topic: "Puerta al universo", phone: "315 3473859", recording_status: "live", program_type: "Puerta al universo", day_of_week: "tuesday", time_slot: 2, week_date: "2026-03-30" },
  { name: "Leisa Puentes", position: "sexóloga", topic: "Amor y deseo, ¿Van juntos?", phone: null, recording_status: "live", day_of_week: "wednesday", time_slot: 2, week_date: "2026-03-30" },
  // Slot 3
  { name: "Naty y Margarita", position: "influencers", topic: "Creadoras de \"Probadoras de confianza\"", phone: "+573118138124", recording_status: "live", day_of_week: "monday", time_slot: 3, week_date: "2026-03-30" },
  { name: "James Pérez", position: "cantante", topic: "Lanzamiento", phone: "+573203721710", recording_status: "live", day_of_week: "tuesday", time_slot: 3, week_date: "2026-03-30" },
  { name: "Carolina Vega", position: "cantante", topic: "Lanzamiento \"París\"", phone: "+573164642339", recording_status: "live", day_of_week: "wednesday", time_slot: 3, week_date: "2026-03-30" },

  // ============================================================
  // SEMANA 2026-04-06
  // ============================================================
  // Slot 1
  { name: "Choco Orta", position: "Cantante", topic: "Lanzamiento canción \"El Astro\" Feat Andy Montañez", phone: "+573103100089", recording_status: "live", day_of_week: "monday", time_slot: 1, week_date: "2026-04-06" },
  { name: "Daniela Ospina", position: "Ex esposa de James", topic: "Roadshow República Dominicana", phone: null, recording_status: "live", day_of_week: "tuesday", time_slot: 1, week_date: "2026-04-06" },
  { name: "Laura Tobón", position: "presentadora", topic: "Plataforma \"Influencer verified\"", phone: "+573114533081", recording_status: "live", day_of_week: "wednesday", time_slot: 1, week_date: "2026-04-06" },
  // Slot 2
  { name: "José Ivorra", position: null, topic: "Historias que merecen ser contadas", phone: "+573204859604", recording_status: "live", program_type: "Lunes de historias que merecen ser contadas", day_of_week: "monday", time_slot: 2, week_date: "2026-04-06" },
  { name: "Germán Puerta", position: "astrónomo", topic: "Puerta al universo", phone: "315 3473859", recording_status: "live", program_type: "Puerta al universo", day_of_week: "tuesday", time_slot: 2, week_date: "2026-04-06" },
  { name: "Luis Victoria", position: "abogado de migración", topic: "Migración hacia Estados Unidos", phone: "+13056007560", recording_status: "live", program_type: "Miércoles de Tutoriales radiales", day_of_week: "wednesday", time_slot: 2, week_date: "2026-04-06" },

  // ============================================================
  // SEMANA 2026-04-13
  // ============================================================
  // Slot 1
  { name: "Tulio Zuloaga", position: "Chef", topic: "Burger Master 2026", phone: "+573105030832", recording_status: "live", day_of_week: "monday", time_slot: 1, week_date: "2026-04-13" },
  { name: "Carmen Velasco Linares", position: "Escritora", topic: "Libro \"Crónica de un secuestro\"", phone: "+573214822344", recording_status: "live", day_of_week: "wednesday", time_slot: 1, week_date: "2026-04-13" },
  // Slot 2
  { name: "Germán Puerta", position: "astrónomo", topic: "Puerta al universo", phone: "315 3473859", recording_status: "live", program_type: "Puerta al universo", day_of_week: "tuesday", time_slot: 2, week_date: "2026-04-13" },

  // ============================================================
  // SEMANA 2026-04-20
  // ============================================================
  { name: "Ezequiel López", position: "Sexólogo", topic: "Lanzamiento libro", phone: "+573184878766", recording_status: "live", day_of_week: "tuesday", time_slot: 1, week_date: "2026-04-20" },
  { name: "Germán Puerta", position: "astrónomo", topic: "Puerta al universo", phone: "315 3473859", recording_status: "live", program_type: "Puerta al universo", day_of_week: "tuesday", time_slot: 2, week_date: "2026-04-20" },

  // ============================================================
  // SEMANA 2026-04-27
  // ============================================================
  { name: "Natalia Ponce de León", position: null, topic: "Acompañamiento a sobrevivientes", phone: null, recording_status: "live", day_of_week: "monday", time_slot: 1, week_date: "2026-04-27" },
  { name: "Guayacán (Alexis Lozano o Nino Caicedo)", position: null, topic: "40 años de carrera", phone: "+573122823439", recording_status: "live", day_of_week: "wednesday", time_slot: 1, week_date: "2026-04-27" },
  { name: "Germán Puerta", position: "astrónomo", topic: "Puerta al universo", phone: "315 3473859", recording_status: "live", program_type: "Puerta al universo", day_of_week: "tuesday", time_slot: 2, week_date: "2026-04-27" },

  // ============================================================
  // MAYO 2026 - Solo Germán Puerta confirmado
  // ============================================================
  { name: "Germán Puerta", position: "astrónomo", topic: "Puerta al universo", phone: "315 3473859", recording_status: "live", program_type: "Puerta al universo", day_of_week: "tuesday", time_slot: 2, week_date: "2026-05-04" },
  { name: "Germán Puerta", position: "astrónomo", topic: "Puerta al universo", phone: "315 3473859", recording_status: "live", program_type: "Puerta al universo", day_of_week: "tuesday", time_slot: 2, week_date: "2026-05-11" },
  { name: "Germán Puerta", position: "astrónomo", topic: "Puerta al universo", phone: "315 3473859", recording_status: "live", program_type: "Puerta al universo", day_of_week: "tuesday", time_slot: 2, week_date: "2026-05-18" },
  { name: "Germán Puerta", position: "astrónomo", topic: "Puerta al universo", phone: "315 3473859", recording_status: "live", program_type: "Puerta al universo", day_of_week: "tuesday", time_slot: 2, week_date: "2026-05-25" },
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    let inserted = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const guest of guests) {
      // Check for duplicate
      const { data: existing } = await supabase
        .from("guests")
        .select("id")
        .eq("week_date", guest.week_date)
        .eq("day_of_week", guest.day_of_week)
        .eq("time_slot", guest.time_slot)
        .eq("name", guest.name)
        .maybeSingle();

      if (existing) {
        skipped++;
        continue;
      }

      const { error } = await supabase
        .from("guests")
        .insert({
          name: guest.name,
          position: guest.position || null,
          topic: guest.topic,
          phone: guest.phone || null,
          recording_status: guest.recording_status,
          program_type: guest.program_type || null,
          day_of_week: guest.day_of_week,
          time_slot: guest.time_slot,
          week_date: guest.week_date,
        });

      if (error) {
        errors.push(`Error inserting ${guest.name} (${guest.week_date} ${guest.day_of_week} slot ${guest.time_slot}): ${error.message}`);
      } else {
        inserted++;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        total: guests.length,
        inserted,
        skipped,
        errors: errors.length > 0 ? errors : undefined,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
