import Link from "next/link";
import { Button } from "@/components/ui/button";
import { TreePine, Users, Share2, Download, Sparkles, ArrowRight, Github, Mail, Code } from "lucide-react";
import { ContactForm } from "@/components/ContactForm";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 via-amber-50 to-white">
      {/* Navigation */}
      <nav className="container mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TreePine className="h-8 w-8 text-emerald-600" />
            <span className="text-xl font-bold text-emerald-800">Family Tree Generator</span>
          </div>
          <div className="flex items-center gap-4">
            <a
              href="https://github.com/AHILL-0121"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-600 hover:text-emerald-600 transition-colors"
              title="GitHub"
            >
              <Github className="h-5 w-5" />
            </a>
            <a
              href="#contact"
              className="text-gray-600 hover:text-emerald-600 transition-colors font-medium"
            >
              Contact
            </a>
            <Link href="/editor">
              <Button variant="outline" className="border-emerald-600 text-emerald-700 hover:bg-emerald-50">
                Open Editor
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="container mx-auto px-6 py-20 text-center">
        <div className="max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 bg-emerald-100 text-emerald-800 px-4 py-2 rounded-full text-sm font-medium mb-6">
            <Sparkles className="h-4 w-4" />
            Free & Easy to Use
          </div>
          
          <h1 className="text-5xl md:text-6xl font-bold text-gray-900 mb-6 leading-tight">
            Create Beautiful
            <span className="text-emerald-600"> Family Trees</span>
            <br />
            in Minutes
          </h1>
          
          <p className="text-xl text-gray-600 mb-10 max-w-2xl mx-auto">
            Build, visualize, and share your family history with our intuitive family tree generator. 
            Perfect for genealogy enthusiasts and families preserving their heritage.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/editor">
              <Button size="lg" className="bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-6 text-lg">
                Open Editor
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
          </div>
        </div>

        {/* Preview Image/Mockup */}
        <div className="mt-16 max-w-5xl mx-auto">
          <div className="bg-white rounded-2xl shadow-2xl border overflow-hidden">
            <div className="bg-gray-100 px-4 py-3 flex items-center gap-2 border-b">
              <div className="w-3 h-3 rounded-full bg-red-400"></div>
              <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
              <div className="w-3 h-3 rounded-full bg-green-400"></div>
              <span className="ml-4 text-sm text-gray-500">Family Tree Editor</span>
            </div>
            <div className="p-8 bg-gradient-to-br from-emerald-50 to-amber-50 min-h-[300px] flex items-center justify-center">
              <div className="flex flex-col items-center gap-4">
                {/* Simple tree visualization */}
                <div className="flex flex-col items-center">
                  <div className="w-20 h-20 rounded-full bg-emerald-200 border-4 border-emerald-400 flex items-center justify-center">
                    <Users className="h-8 w-8 text-emerald-700" />
                  </div>
                  <div className="w-1 h-8 bg-emerald-400"></div>
                  <div className="flex gap-16">
                    <div className="flex flex-col items-center">
                      <div className="w-16 h-16 rounded-full bg-amber-200 border-4 border-amber-400 flex items-center justify-center">
                        <Users className="h-6 w-6 text-amber-700" />
                      </div>
                    </div>
                    <div className="flex flex-col items-center">
                      <div className="w-16 h-16 rounded-full bg-amber-200 border-4 border-amber-400 flex items-center justify-center">
                        <Users className="h-6 w-6 text-amber-700" />
                      </div>
                    </div>
                  </div>
                </div>
                <p className="text-gray-500 text-sm mt-4">Your family tree awaits...</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="container mx-auto px-6 py-20">
        <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">
          Everything You Need to Build Your Family Tree
        </h2>
        
        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          <FeatureCard
            icon={<Users className="h-8 w-8" />}
            title="Easy to Use"
            description="Intuitive drag-and-drop interface. Add family members with just a few clicks and watch your tree grow."
          />
          <FeatureCard
            icon={<Share2 className="h-8 w-8" />}
            title="Multiple Views"
            description="Switch between standard and fancy tree views. Visualize your family connections in beautiful layouts."
          />
          <FeatureCard
            icon={<Download className="h-8 w-8" />}
            title="Export & Share"
            description="Export your family tree as PNG or PDF. Share your family history with relatives near and far."
          />
        </div>
      </section>

      {/* CTA Section */}
      <section className="container mx-auto px-6 py-20">
        <div className="bg-emerald-600 rounded-3xl p-12 text-center text-white max-w-4xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Ready to Start Your Family Tree?
          </h2>
          <p className="text-emerald-100 text-lg mb-8 max-w-2xl mx-auto">
            Join thousands of families preserving their heritage. 
            Start building your family tree today — it&apos;s free!
          </p>
          <Link href="/editor">
            <Button size="lg" variant="secondary" className="bg-white text-emerald-700 hover:bg-emerald-50 px-8 py-6 text-lg">
              Open Editor
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Developer & Contact Section */}
      <section id="contact" className="container mx-auto px-6 py-20">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-4">
            Get In Touch
          </h2>
          <p className="text-center text-gray-600 mb-12 max-w-2xl mx-auto">
            Have questions, feedback, or just want to say hi? Feel free to reach out!
          </p>
          
          <div className="grid md:grid-cols-2 gap-12">
            {/* Developer Info */}
            <div className="bg-white rounded-xl p-8 shadow-lg border">
              <h3 className="text-xl font-semibold text-gray-900 mb-6 flex items-center gap-2">
                <Code className="h-5 w-5 text-emerald-600" />
                Developer
              </h3>
              
              <div className="space-y-6">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-full flex items-center justify-center">
                    <span className="text-2xl font-bold text-white">A</span>
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900">AHILL-0121</h4>
                    <p className="text-gray-500 text-sm">Passionate Coder</p>
                  </div>
                </div>
                
                <p className="text-gray-600">
                  Passionate about building tools that help people connect with their roots 
                  and preserve family memories for generations to come.
                </p>
                
                <div className="flex flex-col gap-3">
                  <a
                    href="https://github.com/AHILL-0121"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 text-gray-700 hover:text-emerald-600 transition-colors group"
                  >
                    <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center group-hover:bg-emerald-50 transition-colors">
                      <Github className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-medium">GitHub</p>
                      <p className="text-sm text-gray-500">@AHILL-0121</p>
                    </div>
                  </a>
                  
                  <div className="flex items-center gap-3 text-gray-700">
                    <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                      <Mail className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-medium">Email</p>
                      <p className="text-sm text-gray-500">Use the contact form →</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Contact Form */}
            <div className="bg-gradient-to-br from-emerald-50 to-amber-50 rounded-xl p-8 shadow-lg border">
              <h3 className="text-xl font-semibold text-gray-900 mb-6 flex items-center gap-2">
                <Mail className="h-5 w-5 text-emerald-600" />
                Send a Message
              </h3>
              <ContactForm />
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t bg-white">
        <div className="container mx-auto px-6 py-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <TreePine className="h-6 w-6 text-emerald-600" />
              <span className="font-semibold text-gray-800">Family Tree Generator</span>
            </div>
            <div className="flex items-center gap-6">
              <a
                href="https://github.com/AHILL-0121"
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-500 hover:text-emerald-600 transition-colors flex items-center gap-2"
              >
                <Github className="h-4 w-4" />
                <span className="text-sm">GitHub</span>
              </a>
              <a
                href="#contact"
                className="text-gray-500 hover:text-emerald-600 transition-colors text-sm"
              >
                Contact
              </a>
            </div>
            <p className="text-gray-500 text-sm">
              © {new Date().getFullYear()} Family Tree Generator. Made by{" "}
              <a
                href="https://github.com/AHILL-0121"
                target="_blank"
                rel="noopener noreferrer"
                className="text-emerald-600 hover:underline"
              >
                AHILL-0121
              </a>
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="bg-white rounded-xl p-6 shadow-lg border hover:shadow-xl transition-shadow">
      <div className="w-14 h-14 bg-emerald-100 rounded-lg flex items-center justify-center text-emerald-600 mb-4">
        {icon}
      </div>
      <h3 className="text-xl font-semibold text-gray-900 mb-2">{title}</h3>
      <p className="text-gray-600">{description}</p>
    </div>
  );
}
