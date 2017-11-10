/*
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */
package org.esciencecloud.jpa.escienceclouddb;

import java.io.Serializable;
import java.util.Collection;
import java.util.Date;
import javax.persistence.Basic;
import javax.persistence.Column;
import javax.persistence.Entity;
import javax.persistence.GeneratedValue;
import javax.persistence.GenerationType;
import javax.persistence.Id;
import javax.persistence.NamedQueries;
import javax.persistence.NamedQuery;
import javax.persistence.OneToMany;
import javax.persistence.Table;
import javax.persistence.Temporal;
import javax.persistence.TemporalType;
import javax.xml.bind.annotation.XmlRootElement;
import javax.xml.bind.annotation.XmlTransient;

/**
 *
 * @author bjhj
 */
@Entity
@Table(name = "appsourcelanguage")
@XmlRootElement
@NamedQueries({
    @NamedQuery(name = "Appsourcelanguage.findAll", query = "SELECT a FROM Appsourcelanguage a")
    , @NamedQuery(name = "Appsourcelanguage.findById", query = "SELECT a FROM Appsourcelanguage a WHERE a.id = :id")
    , @NamedQuery(name = "Appsourcelanguage.findByAppsourcelanguagetext", query = "SELECT a FROM Appsourcelanguage a WHERE a.appsourcelanguagetext = :appsourcelanguagetext")
    , @NamedQuery(name = "Appsourcelanguage.findByActive", query = "SELECT a FROM Appsourcelanguage a WHERE a.active = :active")
    , @NamedQuery(name = "Appsourcelanguage.findByLastmodified", query = "SELECT a FROM Appsourcelanguage a WHERE a.lastmodified = :lastmodified")})
public class Appsourcelanguage implements Serializable {

    private static final long serialVersionUID = 1L;
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Basic(optional = false)
    @Column(name = "id")
    private Integer id;
    @Column(name = "appsourcelanguagetext")
    private String appsourcelanguagetext;
    @Column(name = "active")
    private Integer active;
    @Basic(optional = false)
    @Column(name = "lastmodified")
    @Temporal(TemporalType.TIMESTAMP)
    private Date lastmodified;
    @OneToMany(mappedBy = "appsourcelanguagerefid")
    private Collection<Appappsourcelanguagerel> appappsourcelanguagerelCollection;

    public Appsourcelanguage() {
    }

    public Appsourcelanguage(Integer id) {
        this.id = id;
    }

    public Appsourcelanguage(Integer id, Date lastmodified) {
        this.id = id;
        this.lastmodified = lastmodified;
    }

    public Integer getId() {
        return id;
    }

    public void setId(Integer id) {
        this.id = id;
    }

    public String getAppsourcelanguagetext() {
        return appsourcelanguagetext;
    }

    public void setAppsourcelanguagetext(String appsourcelanguagetext) {
        this.appsourcelanguagetext = appsourcelanguagetext;
    }

    public Integer getActive() {
        return active;
    }

    public void setActive(Integer active) {
        this.active = active;
    }

    public Date getLastmodified() {
        return lastmodified;
    }

    public void setLastmodified(Date lastmodified) {
        this.lastmodified = lastmodified;
    }

    @XmlTransient
    public Collection<Appappsourcelanguagerel> getAppappsourcelanguagerelCollection() {
        return appappsourcelanguagerelCollection;
    }

    public void setAppappsourcelanguagerelCollection(Collection<Appappsourcelanguagerel> appappsourcelanguagerelCollection) {
        this.appappsourcelanguagerelCollection = appappsourcelanguagerelCollection;
    }

    @Override
    public int hashCode() {
        int hash = 0;
        hash += (id != null ? id.hashCode() : 0);
        return hash;
    }

    @Override
    public boolean equals(Object object) {
        // TODO: Warning - this method won't work in the case the id fields are not set
        if (!(object instanceof Appsourcelanguage)) {
            return false;
        }
        Appsourcelanguage other = (Appsourcelanguage) object;
        if ((this.id == null && other.id != null) || (this.id != null && !this.id.equals(other.id))) {
            return false;
        }
        return true;
    }

    @Override
    public String toString() {
        return "org.escience.jpa.escienceclouddb.Appsourcelanguage[ id=" + id + " ]";
    }
    
}
