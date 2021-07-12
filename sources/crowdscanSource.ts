import { Source } from "../src";
import { Page } from "../src/lib/Page";
import { Readable } from 'stream';
import type * as RDF from 'rdf-js';
import { literal, namedNode, quad } from '@rdfjs/data-model';
let mqtt = require('mqtt');

//Source van de api van de langemunt
export class mySource extends Source {

  private crowdscansource = class CrowdscanSource extends Source {

    public observations: RDF.Quad[];
    public time: Date;
    public parent:mySource;

    constructor(config: object,parent:mySource) {
      super(config);
      this.observations = [];
      this.time = new Date();
      this.parent = parent;
    }

    public async appendObservation(rdf: RDF.Quad[]): Promise<void> {
      console.log("observatie toegevoegd");
      if (this.observations.length == 0) {
        this.observations = rdf;
      } else {
        if (this.observations.length >= 50) {
          this.observations = this.observations.concat(rdf);
          this.createPage();
          this.observations = [];
        } else {
          this.observations = this.observations.concat(rdf);
          console.log(this.observations.length);
        }

      }

    }

    public getFeatures(triples: RDF.Quad[]): void {
      //geen idee hoe ik hier prefixen moet toevoegen so let's just not
      //voor elke source is er andere metadata

      let environment = this.config['environment'];
      let aantal: number = this.config['sensors'];
      //feature of Interest
      triples.push(
        quad(
          namedNode('https://production.crowdscan.be/dataapi/gent/environments/' + environment),
          namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
          namedNode('http://www.w3.org/ns/sosa/FeatureOfInterest')
        )
      );

      //observable property
      triples.push(
        quad(
          namedNode('hoeveelheid_mensen'),
          namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
          namedNode('http://www.w3.org/ns/sosa/ObservableProperty')
        )
      );
      triples.push(
        quad(
          namedNode('hoeveelheid_mensen'),
          namedNode('http://www.w3.org/2000/01/rdf-schema#label'),
          literal("hoeveelheid mensen")
        )
      );
      //platform
      triples.push(
        quad(
          namedNode(environment + '_platform'),
          namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
          namedNode('http://www.w3.org/ns/sosa/Platform')
        )
      );
      for (let i = 1; i <= aantal; i++) {
        triples.push(
          quad(
            namedNode('https://production.crowdscan.be/dataapi/gent/environments/' + environment),
            namedNode('http://www.w3.org/ns/sosa/hasSample'),
            namedNode(environment + i + '_sample')
          )
        );
      }

      //samples aanmaken
      for (let i = 1; i <= aantal; i++) {
        triples.push(
          quad(
            namedNode(environment + i + '_sample'),
            namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
            namedNode('http://www.w3.org/ns/sosa/Sample')
          )
        );

        triples.push(
          quad(
            namedNode(environment + i + '_sample'),
            namedNode('http://www.w3.org/ns/sosa/isSampleOf'),
            namedNode('https://production.crowdscan.be/dataapi/gent/environments/' + environment)
          )
        );

        triples.push(
          quad(
            namedNode(environment + i + '_sample'),
            namedNode('http://www.w3.org/2000/01/rdf-schema#comment'),
            literal(environment + ' is opgedeeld in ' + aantal + ' delen en dit is het sample van deel ' + i)
          )
        );
      }
      for (let i = 1; i <= aantal; i++) {

        triples.push(
          quad(
            namedNode(environment + '_platfom'),
            namedNode('http://www.w3.org/ns/sosa/hosts'),
            namedNode(environment + i + '_sensor')
          )
        );
      }
      //sensoren aanmaken
      for (let i = 1; i <= aantal; i++) {
        triples.push(
          quad(
            namedNode(environment + i + '_sensor'),//hier ga ik gewoon een cijfer achter zetten
            namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
            namedNode('http://www.w3.org/ns/sosa/sensor')
          )
        );

        triples.push(
          quad(
            namedNode(environment + i + '_sensor'),
            namedNode('http://www.w3.org/ns/sosa/isHostedBy'),
            namedNode(environment + '_platform')
          )
        );

        //LDES
        triples.push(
          quad(
            namedNode('https://production.crowdscan.be/dataapi/gent/environments/eventStream'),
            namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
            namedNode('https://w3id.org/ldes#EventStream')
          )
        );
      }
    }

    public makeObservation(data: string): RDF.Quad[] {
      console.log("observatie gemaakt");
      let rdf: RDF.Quad[];
      rdf = [];

      let inhoud = JSON.parse(data);
      let payload = inhoud["payload"]["regions"];
      let tijd: Date = new Date(inhoud['header']['time']);
      console.log(tijd);

      this.time = tijd;

      let environment = inhoud['header']['environment'];

      function makeSingleObservation(headCount: any, suffix: number, environment: string): void {
        rdf.push(
          quad(
            namedNode('https://production.crowdscan.be/dataapi/gent/environments/evenstream'),
            namedNode('https://w3id.org/tree#member'),
            namedNode('observation' + tijd.getTime())
          )
        );
        rdf.push(
          quad(
            namedNode('observation'),
            namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
            namedNode('http://www.w3.org/ns/sosa/Observation')
          )
        );

        rdf.push(
          quad(
            namedNode('observation'),
            namedNode('http://www.w3.org/ns/sosa/hasFeatureOfInterest'),
            namedNode('https://production.crowdscan.be/dataapi/gent/environments/' + environment)
          )
        );

        rdf.push(
          quad(
            namedNode('observation'),
            namedNode('http://www.w3.org/ns/sosa/observedProperty'),
            namedNode('hoeveelheid_mensen')
          )
        );

        rdf.push(
          quad(
            namedNode('observation'),
            namedNode('http://www.w3.org/ns/sosa/resultTime'),
            literal(tijd.toString())
          )
        );

        rdf.push(
          quad(
            namedNode('observation'),
            namedNode('http://www.w3.org/ns/sosa/hasSimpleResult'),
            literal(headCount)
          )
        );

        rdf.push(
          quad(
            namedNode('observation'),
            namedNode('http://www.w3.org/ns/sosa/phenomenonTime'),
            literal(tijd.toString())
          )
        );

        rdf.push(
          quad(
            namedNode('observation'),
            namedNode('http://www.w3.org/ns/sosa/madeBySensor'),
            namedNode(environment + suffix + '_sensor')
          )
        );
      }


      makeSingleObservation(payload[0], 0, environment);
      this.appendObservation(rdf);
      // console.log(rdf);
      return rdf;

    }



    public async createPage(): Promise<void> {
      let rdf: RDF.Quad[] = [];
      this.getFeatures(rdf);
      rdf = rdf.concat(this.observations);

      this.createHyperMedia(rdf);
      //ik denk niet dat deze await eigenlijk moet? dubbelcheck dit
      let p = new Page([], rdf);
      console.log("page is created!");
      console.log(p);
      this.parent.createPage([p]);
    }

    public createHyperMedia(rdf: RDF.Quad[]): void {
      rdf.push(
        quad(
          namedNode('https://production.crowdscan.be/dataapi/gent/environments/evenstream'),
          namedNode('https://w3id.org/tree#view'),
          namedNode('thispage')
        )
      );
      rdf.push(
        quad(
          namedNode('thispage'),
          namedNode('https://w3id.org/tree#relation'),
          namedNode('r1')
        )
      );

      rdf.push(
        quad(
          namedNode('thispage'),
          namedNode('https://w3id.org/tree#relation'),
          namedNode('r1')
        )
      );

      rdf.push(
        quad(
          namedNode('r1'),
          namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
          namedNode('https://w3id.org/tree#GreaterThanRelation')
        )
      );

      rdf.push(
        quad(
          namedNode('r1'),
          namedNode('https://w3id.org/tree#path'),
          namedNode('http://www.w3.org/ns/sosa/resultTime')
        )
      );

      rdf.push(
        quad(
          namedNode('r1'),
          namedNode('https://w3id.org/tree#value'),
          literal(this.time.toString())
        )
      );

      rdf.push(
        quad(
          namedNode('r1'),
          namedNode('https://w3id.org/tree#node'),
          namedNode('nextPage')
        )
      );

    }
  }

  private readable: Readable;
  private cr;

  constructor(config: object) {
    super(config);
    this.config = config;
    this.cr = new this.crowdscansource(this.config,this);
    this.readable = this.createRStream();
  }

  public getStreamIfExists() {

    return this.readable;
  }

  public createPage(p:Page[]){
    super.importPages(p);
  }

  public createRStream(): Readable {
    //console.log(console.log("de date is "+this.time));
    let r = new Readable();
    let cr = this.cr;

    //deze functies moet ik aan een variabele toekennnen
    //anders worden die niet opgeroepen
    let rdf: RDF.Quad[];

    let tijd: Date;

    let client = mqtt.connect(
      'mqqt://data.crowdscan.be', {
      username: 'opendata',
      password: 'Tvu2yMCbBW2PzKVn'
    }, (err: any) => {
      if (err) console.log("er is een error" + err.message);
    }
    );

    client.on('connect', () => {
      console.log('connected');
    });

    client.subscribe('/gent/gent_langemunt');

    client.on('message', function (topic: string, message: string, packet: any) {
      // console.log('message is: ' + message);
      tijd = new Date(JSON.parse(message)['header']['time']);
      rdf = cr.makeObservation(message);


      let val = Buffer.from(JSON.stringify(rdf));
      r.read = function () {
        return val;
      }
      r.unshift(val);
      r.push(val);
    });

    client.on('error', function (err: any) {
      console.log('error ' + err);
    });

    return r;
  }


  // // VOORBEELD HOE DE STREAM WERKT:
  // let r = this.getStreamIfExists();

  // //dit moet er bij staan
  // //de readable stream functie read wordt gebruikt, 
  // //maar toch moet dit erbij staan omdat die anders neit
  // r.read = function () { };

  // r.on('readable', function () {
  //   let data: Buffer = r.read();
  //   let ans = data.toString();
  //   console.log(ans);
  // });




}