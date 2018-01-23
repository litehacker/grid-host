/** Copyright 2017-2018 Stewart Allen -- All Rights Reserved */
"use strict";

const crc32 = require('buffer-crc32');
const net   = require('net');
const fs    = require('fs');

function lpad(s, l, pv) {
    while (s.length < l) s = (pv || ' ') + s;
    return s;
}

function rpad(s, l, pv) {
    while (s.length < l) s = s + (pv || ' ');
    return s;
}

function str(v, b) {
     return lpad(v.toString(16), b*2, '0') + "=" + rpad(v.toString(10), b*3);
}

function dump(buf, skip, words, word) {
    // new Packet(buf);
    let left = '';
    let right = '';
    let index = 0;
    let count = 0;
    words = words || 4;
    word = word || 4;
    let wout = word * words;
    let leftpad = words * (word * 3 + 1);
    let emit = function() {
        console.log(rpad(left, leftpad) + right);
        left = '';
        right = '';
        count = 0;
    };

    if (skip) buf = buf.slice(skip);

    while (index < buf.length) {
        let ch = buf.readUInt8(index++);
        left += lpad(ch.toString(16), 2, '0') + ' ';
        right += String.fromCharCode(ch > 32 && ch < 128 ? ch : 32);
        if (++count == wout) emit();
        if (count && count % word === 0) left += ' ';
    }

    if (count) emit();

    // console.log({len: buf.length, lines: buf.length / wout});
}

function decode(buf) {
    const pkt = new Packet(buf);
    const inp = new Reader(buf);
    const len = inp.readInt(),
            s1 = inp.readInt(),     // packet type
            s2 = inp.readByte(),
            s3 = inp.readByte(),
            m1 = inp.readInt(),     // 0xffffffff (magic1)
            m2 = inp.readInt(),     // 0xffffffff (magic2)
            c1 = inp.readInt(),     // command1 (4 bytes)
            c2 = inp.readShort(),   // command2 (2 bytes)
            c3 = inp.readShort(),   // command3 (2 bytes)
            c4 = inp.readShort(),   // command4 (2 bytes)
            xx = s1 === 3 || s1 === 8 ? inp.readByte() : 0, // random extra byte when s1 == 3
            c5 = inp.readShort(),   // command5 (2 bytes)
            c6 = inp.readShort();   // command6 (2 bytes)

    switch (pkt.getCommand()) {
        case 0x01: // client string command (home.getinfo or setting.getinfo)
            console.log({command: inp.readString(c5)});
            break;
        case 0x02: // server home.getinfo
            // let skip = inp.readBytes(20);
            // console.log("<< home.info = " + JSON.stringify({
            //     nb: lpad(inp.readInt().toString(2), 16, '0'),
            //     ns: lpad(inp.readInt().toString(2), 16, '0')
            //     /**
            //       0 = 0000000000000000 = 0
            //       1 = 0011111110000000 = 16256
            //       2 = 0100000000000000 = 16384
            //       3 = 0100000001000000 = 16448
            //       4 = 0100000010000000 = 16512
            //       5 = 0100000010100000 = 16544
            //       6 = 0100000011000000 = 16576
            //       7 = 0100000011100000 = 16608
            //       8 = 0100000100000000 = 16640
            //       9 = 0100000100010000 = 16656
            //      10 = 0100000100100000 = 16672
            //      11 = 0100000100110000
            //      12 = 0100000101000000
            //      13 = 0100000101010000
            //      14 = 0100000101100000
            //      15 = 0100000101110000
            //      16 = 0100000110000000
            //      17 = 0100000110001000
            //      25 = 0100000111001000
            //      32 = 0100001000000000
            //      64 = 0100001010000000
            //     128 = 0100001100000000
            //      */
            // }));
            // dump(buf);
            console.log(pkt.data);
            break;
        case 0x03: // client gcode command (M104 T0 S0) (ends w/ "\n")
            console.log({gcode: inp.readString(c5).trim()});
            break;
        case 0x04: // client get dir info
            console.log(">> get dir info");
            console.log(pkt.data);
            // dump(buf);
            break;
        case 0x05: // server dir info
            console.log("<< dir info");
            console.log(pkt.data);
            // dump(buf);
            break;
        case 0x06: // client get file info
            console.log(">> get file info");
            console.log(pkt.data);
            // dump(buf);
            break;
        case 0x07: // server file info
            console.log("<< file info");
            console.log(pkt.data);
            // dump(buf);
            break;
        case 0x08: // client start print
            console.log(">> start print: " + inp.readString(c5));
            console.log(pkt.data);
            // dump(buf);
            break;
        case 0x09: // server print start ACK
            console.log("<< print started");
            console.log(pkt.data);
            // dump(buf);
            break;
        case 0x0a: // server setting.getinfo
            console.log("<< settings.info");
            console.log(pkt.data);
            break;
        default:
            dump(buf);
            break;
    }
}

class Reader {
    constructor(buffer) {
        this.buffer = buffer;
        this.index = 0;
    }

    remain() {
        return this.buffer.length - this.index;
    }

    readByte() {
        if (this.remain() < 1) return 0;
        const data = this.buffer.readUInt8(this.index);
        this.index += 1;
        return data;
    }

    readInt() {
        if (this.remain() < 4) return 0;
        const data = this.buffer.readUInt32LE(this.index);
        this.index += 4;
        return data;
    }

    readLong() {
        if (this.remain() < 8) return 0;
        const data = (
            this.buffer.readUInt32LE(this.index) &
            this.buffer.readUInt32LE(this.index) << 32
        );
        this.index += 8;
        return data;
    }

    readIntBE() {
        if (this.remain() < 4) return 0;
        const data = this.buffer.readUInt32BE(this.index);
        this.index += 4;
        return data;
    }

    readShort() {
        if (this.remain() < 2) return 0;
        const data = this.buffer.readUInt16LE(this.index);
        this.index += 2;
        return data;
    }

    readBytes(len) {
        if (this.remain() < len) return null;
        const data = this.buffer.slice(this.index, this.index + len);
        this.index += len;
        return data;
    }

    readString(len, enc) {
        if (!len) len = this.readInt();
        if (this.remain() < len) return null;
        return this.readBytes(len).toString(enc || 'utf16le');
    }
}

class N2Print {
    constructor(file, host, port) {
        this.file = file;
        this.host = host;
        this.port = port;
        const socket = new net.Socket().connect({
            host: host,
            port: port
        })
            .on("connect", data => {
                // console.log("connected");
                var packet = new Packet()
                    .setCommand(0x8)
                    .setHeader(1,0,0,0,2)
                    .append([1])
                    .writeInt(file.length * 2)
                    .append(file)
                    .append([0,0,0,0])
                    .update();
                // dump(packet.buf);
                socket.write(packet.buf);
            })
            .on("data", data => {
                console.log({printing: file});
                // dump(data);
                socket.end();
            })
            .on("error", (error) => {
                socket.end();
            })
            .on("end", () => {
                socket.end();
            })
            .on("close", () => {
                // console.log("closed");
            })
            ;
    }
}

class N2Send {
    constructor(file, host, port, fileName, onDone) {
        const fbuf = fs.readFileSync(file);
        fileName = (fileName || file).split('/');
        fileName = fileName[fileName.length-1];
        console.log({sending: fileName, to: host, port: port});
        let tf = 1024 / 1000;
        let time = new Date().getTime();
        let seqno = 1;
        let findx = 0;
        const socket = new net.Socket().connect({
            host: host,
            port: port
        })
            .on("connect", data => {
                // console.log("connected");
                let packet = new Packet()
                    .setCommand(0xc)
                    .setHeader(0, 0, 0, 2, 1)
                    .writeInt(fbuf.length)
                    .writeInt(0) // 0
                    .writeInt(0) // data length
                    .writeInt(0) // 0
                    .writeInt(fileName.length * 2)
                    .append(fileName)
                    .update();
                // console.log("--- client ---");
                // packet.dump();
                socket.write(packet.buf);
            })
            .on("data", data => {
                // console.log("--- server ---");
                // dump(data);
                let packet = new Packet(data);
                if (packet.getCommand() == 0xd) {
                    fileName = packet.readLengthString(48);
                    console.log({location: fileName});
                }
                let tosend = Math.min(fbuf.length - findx, 8192);
                if (tosend <= 0) {
                    socket.end();
                    if (onDone) {
                        onDone(fileName);
                    }
                    return;
                }
                packet = new Packet()
                    .setCommand(0xe)
                    .setHeader(0, 0, 2, 0, 1)
                    .writeInt(seqno++)
                    .writeInt(tosend)
                    .writeInt(tosend)
                    .append(fbuf.slice(findx, findx + tosend))
                    .update();
                // console.log("--- client ---");
                // packet.dump();
                socket.write(packet.buf);
                findx += tosend;
                let mark = new Date().getTime();
                console.log({
                    progress: (100 * findx / fbuf.length).toFixed(2),
                    rate: Math.round((findx/(mark-time))*tf), // kB/sec
                    time: ((mark-time)/1000).toFixed(2) // seconds
                });
            })
            .on("error", (error) => {
                socket.end();
            })
            .on("end", () => {
                socket.end();
            })
            .on("close", () => {
                // console.log("closed");
            })
            ;
    }}

class Packet {
    constructor(buf) {
        if (buf) {
            this.decode(buf);
        }
        this.buf = buf || Buffer.from([
            0, 0, 0, 0, // packet length
            0, 0, 0, 0, // command
            1,          // version
            0,          // 0=client, 1=server
            0xff, 0xff, 0xff, 0xff, // magic
            0xff, 0xff, 0xff, 0xff, // magic
            0, 0,       // h0 (# bytes)
            0, 0,       // h1 (# shorts)
            0, 0,       // h2 (# ints)
            2, 0,       // h3 (# longs)
            1, 0        // h4 (# strings)
        ]);
    }

    decode(buf) {
        let inp = new Reader(buf);
        let data = this.data = {
            len: inp.readInt(),     // packet length
            typ: inp.readInt(),     // packet type
            ver: inp.readByte(),    // packet version
            cs:  inp.readByte(),    // 0=client, 1=server
            m1:  inp.readInt(),     // 0xffffffff (magic1)
            m2:  inp.readInt(),     // 0xffffffff (magic2)
            nb:  inp.readShort(),   // # bytes
            ns:  inp.readShort(),   // # shorts
            ni:  inp.readShort(),   // # ints
            nl:  inp.readShort(),   // # longs
            nS:  inp.readShort(),   // # strings
            bd:  [],                // byte data
            sd:  [],                // short data
            id:  [],                // int data
            ld:  [],                // long data
            Sd:  []                 // String data
        };
        for (let i=0; i<data.nb; i++) data.bd.push(inp.readByte())
        for (let i=0; i<data.ns; i++) data.sd.push(inp.readShort())
        for (let i=0; i<data.ni; i++) data.id.push(inp.readInt())
        for (let i=0; i<data.nl; i++) data.ld.push(inp.readLong())
        for (let i=0; i<data.nS; i++) data.Sd.push(inp.readString())
    }

    getCommand() {
        return this.buf.readUInt32LE(4);
    }

    setCommand(c) {
        this.buf.writeUInt32LE(c, 4);
        return this;
    }

    getMagic() {
        return [
            this.buf.readUInt32LE(10),
            this.buf.readUInt32LE(4)
        ];
    }

    setMagic(v0, v1) {
        this.buf.writeUInt32LE(v0, 10);
        this.buf.writeUInt32LE(v1, 14);
        return this;
    }

    getHeader() {
        return [
            this.buf.readUInt16LE(18),
            this.buf.readUInt16LE(20),
            this.buf.readUInt16LE(22),
            this.buf.readUInt16LE(24),
            this.buf.readUInt16LE(26)
        ];
    }

    setHeader(v0, v1, v2, v3, v4, v5) {
        this.buf.writeUInt16LE(v0, 18);
        this.buf.writeUInt16LE(v1, 20);
        this.buf.writeUInt16LE(v2, 22);
        this.buf.writeUInt16LE(v3, 24);
        this.buf.writeUInt16LE(v4, 26);
        return this;
    }

    readBytes(pos, len) {
        return this.buf.slice(pos, pos+len);
    }

    readString(pos, len, enc) {
        return this.readBytes(pos, len).toString(enc || 'utf16le');
    }

    readLengthString(pos, enc) {
        let len = this.readInt(pos);
        return this.readBytes(pos + 4, len).toString(enc || 'utf16le');
    }

    readShort(pos) {
        return this.buf.readUInt16BE(pos);
    }

    readInt(pos) {
        return this.buf.readUInt32BE(pos);
    }

    writeShort(v) {
        let pos = this.buf.length;
        this.append([0,0]);
        this.buf.writeUInt16LE(v, pos);
        return this;
    }

    writeInt(v) {
        let pos = this.buf.length;
        this.append([0,0,0,0]);
        this.buf.writeUInt32LE(v, pos);
        return this;
    }

    append(buf) {
        if (typeof(buf) === 'string') {
            buf = Buffer.from(buf, "utf16le");
        } else if (Array.isArray(buf)) {
            buf = Buffer.from(buf);
        }
        this.buf = Buffer.concat([this.buf, buf]);
        return this;
    }

    update() {
        this.buf.writeUInt32LE(this.buf.length - 4, 0);
        return this;
    }

    dump() {
        dump(this.buf);
    }
}

class TCPipe {
    constructor(lport, dhost, dport) {
        this.server = net.createServer(client => {
            let last = null;
            let buf = null;
            const emit = (socket, buffer) => {
                console.log("--- " + socket.name + " ---");
                decode(buffer);
            };
            const onData = (socket, buffer) => {
                if (last != socket) { emit(socket, buffer); buf = buffer }
                else { buf = Buffer.concat([buf, buffer]) }
                last = socket;
            };
            client
                .on("data", data => {
                    onData(client, data);
                    socket.write(data);
                })
                .on("error", (error) => {
                    client.end();
                })
                .on("end", () => {
                    client.end();
                })
                .on("close", () => {
                    // ok
                })
                ;
            const socket = new net.Socket().connect({
                host: dhost,
                port: dport
            })
                .on("data", data => {
                    onData(socket, data);
                    client.write(data);
                })
                .on("error", (error) => {
                    socket.end();
                })
                .on("end", () => {
                    socket.end();
                    emit(last, buf);
                })
                .on("close", () => {
                    // ok
                })
                ;
            client.name = "client";
            socket.name = "server";
        })
            .on("error", error => { console.log(error)} )
            .listen(lport, () => { })
            ;
    }
}

module.exports = {
    TCPipe: TCPipe
};

if (!module.parent) {
    const arg = process.argv.slice(2);
    const cmd = arg.shift() || '';
    let file, host, port, lport, fname;

    switch (cmd) {
        case 'dump':
            file = arg.shift();
            let skip = parseInt(arg.shift() || "0");
            let words = parseInt(arg.shift() || "4");
            let word = parseInt(arg.shift() || "4");
            fs.readFile(file, function(err, data) {
                dump(data, skip, words, word);
            })
            break;
        case 'pipe':
            host = arg.shift() || "localhost";
            port = arg.shift() || "31625";
            lport = arg.shift() || port;
            new TCPipe(parseInt(lport), host, parseInt(port));
            break;
        case 'send':
            file = arg.shift();
            host = arg.shift() || "localhost";
            port = arg.shift() || "31626";
            fname = arg.shift();
            new N2Send(file, host, parseInt(port), fname);
            break;
        case 'kick':
            file = arg.shift();
            host = arg.shift() || "localhost";
            port = arg.shift() || "31625";
            new N2Print(file, host, parseInt(port));
            break;
        case 'print':
            file = arg.shift();
            host = arg.shift() || "localhost";
            port = parseInt(arg.shift() || "31625");
            fname = arg.shift();
            new N2Send(file, host, port + 1, fname, function(filename) {
                new N2Print(filename, host, port);
            });
            break;
        default:
            console.log([
                "invalid command: " + cmd,
                "usage:",
                "  send  [file] [host] [port] [filename]",
                "  kick  [file] [host] [port]",
                "  print [file] [host] [port] [filename]"
            ].join("\n"));
            break;
    }
}
